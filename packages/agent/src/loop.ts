import type { ChatMessage } from "@otoclaw/providers";
import type { PermissionCheckInput, PermissionDecision } from "@otoclaw/permission";
import type { AgentEvents } from "./types";
import { codeTestDebug } from "./codeTestDebug";
import { intake } from "./intake";
import { planner } from "./planner";
import { router, UnsupportedRouteError } from "./router";
import type { Plan, PlanStep, RunContext, TaskIntake } from "./types";

/** Default policy decision per permission key when nothing else resolves it (ARCHITECTURE.md §4). */
const DEFAULT_PERMISSION_BY_KEY: Record<string, PermissionDecision> = {
	"fs.read": "allow",
	"fs.write": "ask",
	shell: "ask",
	"web.fetch": "allow",
};

function toolDefaultFor(permissionKey: string): PermissionDecision {
	return DEFAULT_PERMISSION_BY_KEY[permissionKey] ?? "ask";
}

/** A model turn never loops on tool calls forever, even if a misbehaving stub keeps requesting them. */
const MAX_TOOL_TURNS = 10;

interface AccumulatedToolCall {
	id: string;
	name: string;
	args: string;
}

async function consumeStream(
	stream: AsyncIterable<{ delta?: string; toolCall?: { id: string; name: string; argsDelta: string } }>,
	events: AgentEvents,
): Promise<{ text: string; toolCalls: AccumulatedToolCall[] }> {
	const toolCalls = new Map<string, AccumulatedToolCall>();
	let text = "";
	for await (const chunk of stream) {
		if (chunk.delta) {
			text += chunk.delta;
			events.emit("stream.delta", { text: chunk.delta });
		}
		if (chunk.toolCall) {
			const existing = toolCalls.get(chunk.toolCall.id);
			if (existing) {
				if (chunk.toolCall.name) existing.name = chunk.toolCall.name;
				existing.args += chunk.toolCall.argsDelta ?? "";
			} else {
				toolCalls.set(chunk.toolCall.id, {
					id: chunk.toolCall.id,
					name: chunk.toolCall.name,
					args: chunk.toolCall.argsDelta ?? "",
				});
			}
		}
	}
	return { text, toolCalls: [...toolCalls.values()] };
}

function parseArgs(raw: string): unknown {
	if (!raw) return {};
	try {
		return JSON.parse(raw);
	} catch {
		return {};
	}
}

export interface ModelToolTurnResult {
	text: string;
	blocked: boolean;
	notes: string[];
}

/**
 * Runs the model⇄tool loop for one step: stream the model, and for each requested tool call,
 * check permission, run it (or block it), feed the result back, and continue until the model
 * stops requesting tools.
 */
export async function runModelToolTurn(initialMessages: ChatMessage[], ctx: RunContext): Promise<ModelToolTurnResult> {
	const messages: ChatMessage[] = [...initialMessages];
	let blocked = false;
	const notes: string[] = [];
	let finalText = "";

	for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
		const stream = ctx.provider.chat({
			model: ctx.model,
			messages,
			tools: ctx.toolRegistry.toJsonSchema(),
			signal: ctx.signal,
		});
		const { text, toolCalls } = await consumeStream(stream, ctx.events);
		finalText = text;
		if (toolCalls.length === 0) break;

		messages.push({
			role: "assistant",
			content: text,
			toolCalls: toolCalls.map((c) => ({ id: c.id, name: c.name, args: c.args })),
		});

		for (const call of toolCalls) {
			const tool = ctx.toolRegistry.get(call.name);
			if (!tool) {
				const note = `unknown tool "${call.name}"`;
				notes.push(note);
				messages.push({ role: "tool", toolCallId: call.id, content: JSON.stringify({ ok: false, error: note }) });
				continue;
			}

			const args = parseArgs(call.args);
			const permInput: PermissionCheckInput = {
				toolName: tool.name,
				permissionKey: tool.permissionKey,
				cmd: tool.permissionKey === "shell" ? (args as { cmd?: string }).cmd : undefined,
				mode: ctx.mode,
				toolDefault: toolDefaultFor(tool.permissionKey),
				sessionOverrides: ctx.sessionOverrides,
				projectPolicy: ctx.projectPolicy,
				globalConfig: ctx.globalConfig,
			};
			const check = ctx.permissionEngine.check(permInput);

			let decision = check.decision;
			if (decision === "ask" || check.escalate) {
				ctx.events.emit("permission.request", { toolCallId: call.id, tool: tool.name, args, risk: check.risk });
				const answer = await ctx.permissionChannel.request({
					toolCallId: call.id,
					toolName: tool.name,
					args,
					risk: check.risk,
				});
				decision = answer === "allow" ? "allow" : "deny";
			}

			if (decision === "deny" || decision === "never") {
				blocked = true;
				const note = `permission denied for ${tool.name}`;
				notes.push(note);
				messages.push({ role: "tool", toolCallId: call.id, content: JSON.stringify({ ok: false, error: note }) });
				continue;
			}

			ctx.events.emit("tool.start", { toolCallId: call.id, name: tool.name, args });
			const result = await tool.run(args, ctx.toolContext);
			ctx.events.emit("tool.end", { toolCallId: call.id, name: tool.name, result });
			messages.push({ role: "tool", toolCallId: call.id, content: JSON.stringify(result) });
			if (!result.ok) notes.push(result.error ?? `tool ${tool.name} failed`);
		}
	}

	return { text: finalText, blocked, notes };
}

export interface StepResult {
	stepId: string;
	ok: boolean;
	notes: string[];
}

export interface RunTaskInput {
	userText: string;
	/** Test command used by codeTestDebug() for "code" steps. Defaults to "bun test". */
	testCommand?: string;
}

export interface ReviewResult {
	passed: boolean;
	notes: string[];
}

export interface RunTaskResult {
	intake: TaskIntake;
	plan: Plan;
	stepResults: StepResult[];
	review: ReviewResult;
}

async function executeStep(step: PlanStep, ctx: RunContext, testCommand: string): Promise<StepResult> {
	const messages: ChatMessage[] = [{ role: "user", content: step.description }];
	const turnResult = await runModelToolTurn(messages, ctx);
	const stepNotes = [...turnResult.notes];
	let ok = !turnResult.blocked;

	if (step.kind === "code") {
		const debugResult = await codeTestDebug({ step, testCommand, ctx });
		ok = ok && debugResult.resolved;
		stepNotes.push(...debugResult.notes);
	}

	return { stepId: step.id, ok, notes: stepNotes };
}

/**
 * Implements ARCHITECTURE.md §6's runTask pseudocode: intake -> plan -> route -> execute each
 * step -> review -> deliver. Emits `pipeline.stage` at each transition.
 */
export async function runTask(ctx: RunContext, input: RunTaskInput): Promise<RunTaskResult> {
	const testCommand = input.testCommand ?? "bun test";

	ctx.events.emit("pipeline.stage", { stage: "intake" });
	const taskIntake = await intake(input.userText, ctx.questionChannel);

	ctx.events.emit("pipeline.stage", { stage: "plan" });
	const plan = await planner(taskIntake, ctx.provider, ctx.model, ctx.signal);

	const stepResults: StepResult[] = [];

	for (const step of plan.steps) {
		ctx.events.emit("pipeline.stage", { stage: "route" });
		try {
			router(step);
		} catch (err) {
			if (err instanceof UnsupportedRouteError) {
				stepResults.push({ stepId: step.id, ok: false, notes: [err.message] });
				continue;
			}
			throw err;
		}

		ctx.events.emit("pipeline.stage", { stage: "execute" });
		const result = await executeStep(step, ctx, testCommand);
		stepResults.push(result);
	}

	ctx.events.emit("pipeline.stage", { stage: "review" });
	const passed = stepResults.every((r) => r.ok);
	const notes = stepResults.flatMap((r) => r.notes);
	const review: ReviewResult = { passed, notes };
	ctx.events.emit("review.result", review);

	ctx.events.emit("pipeline.stage", { stage: "deliver" });

	return { intake: taskIntake, plan, stepResults, review };
}
