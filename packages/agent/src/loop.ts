import { randomUUID } from "node:crypto";
import type { ChatMessage } from "@otoclaw/providers";
import type { PermissionCheckInput, PermissionDecision } from "@otoclaw/permission";
import type { Verdict } from "@otoclaw/shared";
import type { AgentEvents } from "./types";
import { codeTestDebug } from "./codeTestDebug";
import { intake } from "./intake";
import { DEFAULT_RUBRIC, judge } from "./judge";
import { planner } from "./planner";
import { router, UnsupportedRouteError, type Route } from "./router";
import { matchDesignSkill } from "./skillMatching";
import { buildBrief, spawnSubAgent } from "./subagents";
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
	stream: AsyncIterable<{
		delta?: string;
		toolCall?: { id: string; name: string; argsDelta: string };
		usage?: { in: number; out: number };
	}>,
	events: AgentEvents,
): Promise<{ text: string; toolCalls: AccumulatedToolCall[]; usage: { in: number; out: number } }> {
	const toolCalls = new Map<string, AccumulatedToolCall>();
	let text = "";
	const usage = { in: 0, out: 0 };
	for await (const chunk of stream) {
		if (chunk.delta) {
			text += chunk.delta;
			events.emit("stream.delta", { text: chunk.delta });
		}
		if (chunk.usage) {
			usage.in += chunk.usage.in;
			usage.out += chunk.usage.out;
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
	return { text, toolCalls: [...toolCalls.values()], usage };
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
	/** Summed provider token usage (ChatChunk.usage) across every model call this turn made. */
	usage: { in: number; out: number };
	/** Number of model calls actually made (bounded by maxTurns). */
	turnsUsed: number;
	/** True when the turn limit was hit while the model still had tool calls to act on. */
	exhausted: boolean;
}

/**
 * Runs the model⇄tool loop for one step: stream the model, and for each requested tool call,
 * check permission, run it (or block it), feed the result back, and continue until the model
 * stops requesting tools. `maxTurns` bounds how many model calls this turn may make — used by
 * sub-agents to enforce their step budget (ARCHITECTURE.md §9).
 */
export async function runModelToolTurn(
	initialMessages: ChatMessage[],
	ctx: RunContext,
	maxTurns: number = MAX_TOOL_TURNS,
): Promise<ModelToolTurnResult> {
	const messages: ChatMessage[] = [...initialMessages];
	let blocked = false;
	const notes: string[] = [];
	let finalText = "";
	const usage = { in: 0, out: 0 };
	let turnsUsed = 0;
	let exhausted = false;

	for (let turn = 0; turn < maxTurns; turn++) {
		turnsUsed = turn + 1;
		const stream = ctx.provider.chat({
			model: ctx.model,
			messages,
			tools: ctx.toolRegistry.toJsonSchema(),
			signal: ctx.signal,
		});
		const { text, toolCalls, usage: turnUsage } = await consumeStream(stream, ctx.events);
		usage.in += turnUsage.in;
		usage.out += turnUsage.out;
		finalText = text;
		if (toolCalls.length === 0) break;
		if (turn === maxTurns - 1) exhausted = true;

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

	return { text: finalText, blocked, notes, usage, turnsUsed, exhausted };
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
	verdicts: Verdict[];
}

async function executeStep(step: PlanStep, route: Route, ctx: RunContext, testCommand: string): Promise<StepResult> {
	if (route.kind === "subagent") {
		const brief = buildBrief(step, route.role);
		const result = await spawnSubAgent(brief, ctx);
		return { stepId: step.id, ok: result.ok, notes: result.notes };
	}

	const skillHint = matchDesignSkill(step, ctx.skillRegistry);
	const stepPrompt = skillHint ? `${skillHint}\n\n${step.description}` : step.description;
	const messages: ChatMessage[] = [{ role: "user", content: stepPrompt }];
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

/** Repair loop never repairs more than this many times before falling back to a question. */
const MAX_REPAIR_ATTEMPTS = 2;

/** A fix turn that folds the judge's notes into a follow-up prompt, mirroring codeTestDebug's fix-turn pattern. */
async function runRepair(step: PlanStep, notes: string[], ctx: RunContext): Promise<void> {
	const fixMessages: ChatMessage[] = [
		{
			role: "user",
			content: `The output for step "${step.description}" did not meet quality expectations:\n${notes.join("\n") || "(no notes)"}\n\nImprove it.`,
		},
	];
	await runModelToolTurn(fixMessages, ctx);
}

export interface StepJudgeOutcome {
	verdicts: Verdict[];
	accepted: boolean;
}

/**
 * Judges a step's output; on a "bad" verdict, repairs and re-judges up to MAX_REPAIR_ATTEMPTS
 * times. If it's still "bad" after the cap, asks the user via a button question rather than
 * silently accepting or looping forever ("Elle düzelt" is offered but not wired to an action yet).
 */
export async function judgeAndRepair(step: PlanStep, ctx: RunContext): Promise<StepJudgeOutcome> {
	const verdicts: Verdict[] = [];

	for (let attempt = 0; ; attempt++) {
		const verdict = await judge({
			artifact: { kind: step.kind === "code" ? "code" : "text", description: step.description, ref: step.id },
			rubric: DEFAULT_RUBRIC,
			ctx,
		});
		verdicts.push(verdict);
		ctx.events.emit("judge.verdict", verdict);

		if (verdict.label === "good") {
			return { verdicts, accepted: true };
		}

		if (attempt >= MAX_REPAIR_ATTEMPTS) {
			const answer = await ctx.questionChannel.ask({
				questionId: randomUUID(),
				header: "Kalite onayı",
				question: "Bu çıktı beklenen kaliteye ulaşmadı, ne yapayım?",
				options: [
					{ id: "accept", label: "Kabul et" },
					{ id: "cancel", label: "İptal" },
					{ id: "manual", label: "Elle düzelt" },
				],
			});
			return { verdicts, accepted: answer.optionId !== "cancel" };
		}

		await runRepair(step, verdict.notes, ctx);
	}
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
	const verdicts: Verdict[] = [];

	for (const step of plan.steps) {
		ctx.events.emit("pipeline.stage", { stage: "route" });
		let route: Route;
		try {
			route = router(step);
		} catch (err) {
			if (err instanceof UnsupportedRouteError) {
				stepResults.push({ stepId: step.id, ok: false, notes: [err.message] });
				continue;
			}
			throw err;
		}

		ctx.events.emit("pipeline.stage", { stage: "execute" });
		const result = await executeStep(step, route, ctx, testCommand);

		if (result.ok) {
			const outcome = await judgeAndRepair(step, ctx);
			verdicts.push(...outcome.verdicts);
			if (!outcome.accepted) {
				result.ok = false;
				result.notes.push("judge rejected the output and the user chose to cancel");
			}
		}

		stepResults.push(result);
	}

	ctx.events.emit("pipeline.stage", { stage: "review" });
	const passed = stepResults.every((r) => r.ok);
	const notes = stepResults.flatMap((r) => r.notes);
	const review: ReviewResult = { passed, notes };
	ctx.events.emit("review.result", review);

	ctx.events.emit("pipeline.stage", { stage: "deliver" });

	return { intake: taskIntake, plan, stepResults, review, verdicts };
}
