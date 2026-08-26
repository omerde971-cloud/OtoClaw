import { randomUUID } from "node:crypto";
import { cpus } from "node:os";
import type { ChatMessage } from "@otoclaw/providers";
import { runModelToolTurn } from "./loop";
import type { PlanStep, RunContext, SubAgentBrief, SubAgentResult } from "./types";
import { createWorktree, discardWorktree, finalizeWorktree, type WorktreeHandle } from "./worktree";

/** Sub-agents get a budget by default so a runaway child can't drain the parent's session. */
export const DEFAULT_SUBAGENT_BUDGET = { tokens: 20_000, steps: 6 } as const;

function detectCoreCount(): number {
	const nav = (globalThis as { navigator?: { hardwareConcurrency?: number } }).navigator;
	if (nav && typeof nav.hardwareConcurrency === "number") {
		return nav.hardwareConcurrency;
	}
	return cpus().length - 2;
}

/** ARCHITECTURE.md §9: min(cores-2, 8), never below 1. */
export function defaultConcurrencyCap(): number {
	return Math.max(1, Math.min(detectCoreCount(), 8));
}

/** Minimal counting semaphore — bounds how many sub-agents run at once; excess callers queue. */
export class Semaphore {
	private available: number;
	private readonly queue: Array<() => void> = [];

	constructor(max: number) {
		this.available = Math.max(1, max);
	}

	acquire(): Promise<() => void> {
		if (this.available > 0) {
			this.available--;
			return Promise.resolve(() => this.release());
		}
		return new Promise((resolve) => {
			this.queue.push(() => resolve(() => this.release()));
		});
	}

	private release(): void {
		const next = this.queue.shift();
		if (next) {
			next();
			return;
		}
		this.available++;
	}
}

let sharedDefaultPool: Semaphore | undefined;
function defaultPool(): Semaphore {
	if (!sharedDefaultPool) sharedDefaultPool = new Semaphore(defaultConcurrencyCap());
	return sharedDefaultPool;
}

type SubAgentBusListener = (payload: unknown) => void;

/** In-process pub/sub keyed by agentId — how the parent observes a running sub-agent's progress. */
export class SubAgentBus {
	private readonly listeners = new Map<string, Set<SubAgentBusListener>>();

	emit(agentId: string, payload: unknown): void {
		for (const listener of this.listeners.get(agentId) ?? []) listener(payload);
	}

	on(agentId: string, listener: SubAgentBusListener): void {
		let set = this.listeners.get(agentId);
		if (!set) {
			set = new Set();
			this.listeners.set(agentId, set);
		}
		set.add(listener);
	}

	off(agentId: string, listener: SubAgentBusListener): void {
		this.listeners.get(agentId)?.delete(listener);
	}
}

/** Pure — turns a plan step into a structured brief, no LLM call, so it's directly testable. */
export function buildBrief(step: PlanStep, role?: SubAgentBrief["role"]): SubAgentBrief {
	return {
		role: role ?? step.role ?? "coder",
		goal: step.description,
		inputs: {},
		constraints: [],
		acceptance: step.acceptance,
		budget: { ...DEFAULT_SUBAGENT_BUDGET },
	};
}

function briefToPrompt(brief: SubAgentBrief): string {
	const lines = [`Goal: ${brief.goal}`];
	if (Object.keys(brief.inputs).length > 0) lines.push(`Inputs: ${JSON.stringify(brief.inputs)}`);
	if (brief.constraints.length > 0) {
		lines.push(`Constraints:\n${brief.constraints.map((c) => `- ${c}`).join("\n")}`);
	}
	if (brief.acceptance.length > 0) {
		lines.push(`Acceptance criteria:\n${brief.acceptance.map((a) => `- ${a}`).join("\n")}`);
	}
	return lines.join("\n\n");
}

export interface SpawnSubAgentOptions {
	agentId?: string;
}

/**
 * Runs one sub-agent to completion under `brief`'s budget, isolated in a git worktree when its
 * role mutates files ("coder"). Never merges the worktree — only isolates and reports the diff
 * (project decision); merge/discard is left to a later review step. Never throws — a crashing
 * child resolves to `ok: false` with the failure in `notes`, so it can't sink the parent run.
 */
export async function spawnSubAgent(
	brief: SubAgentBrief,
	ctx: RunContext,
	options: SpawnSubAgentOptions = {},
): Promise<SubAgentResult> {
	const agentId = options.agentId ?? randomUUID();
	const pool = ctx.subAgentPool ?? defaultPool();
	const release = await pool.acquire();

	ctx.events.emit("subagent.spawn", { agentId, role: brief.role, brief, status: "spawned" });

	let worktree: WorktreeHandle | null = null;
	try {
		if (brief.role === "coder") {
			worktree = await createWorktree(ctx.toolContext.cwd, agentId);
		}

		ctx.events.emit("subagent.update", { agentId, role: brief.role, brief, status: "running" });

		const subCtx: RunContext = worktree
			? { ...ctx, toolContext: { ...ctx.toolContext, cwd: worktree.path } }
			: ctx;

		const messages: ChatMessage[] = [{ role: "user", content: briefToPrompt(brief) }];
		const maxTurns = Math.max(1, brief.budget.steps);
		const turn = await runModelToolTurn(messages, subCtx, maxTurns);

		const tokensUsed = turn.usage.in + turn.usage.out;
		const notes = [...turn.notes];
		let ok = !turn.blocked;

		if (turn.exhausted) {
			notes.push("budget_exceeded: step budget exhausted before the sub-agent finished");
			ok = false;
		}
		if (tokensUsed > brief.budget.tokens) {
			notes.push("budget_exceeded: token budget exceeded");
			ok = false;
		}

		const worktreeResult = worktree ? await finalizeWorktree(worktree) : null;

		const result: SubAgentResult = {
			agentId,
			role: brief.role,
			ok,
			text: turn.text,
			notes,
			tokensUsed,
			stepsUsed: turn.turnsUsed,
			worktree: worktreeResult,
		};
		ctx.events.emit("subagent.done", { agentId, role: brief.role, brief, status: ok ? "done" : "failed", result });
		return result;
	} catch (err) {
		if (worktree) {
			try {
				await discardWorktree(worktree);
			} catch {
				// best-effort cleanup — the primary failure below is what matters
			}
		}
		const message = err instanceof Error ? err.message : String(err);
		const result: SubAgentResult = {
			agentId,
			role: brief.role,
			ok: false,
			text: "",
			notes: [`subagent crashed: ${message}`],
			tokensUsed: 0,
			stepsUsed: 0,
			worktree: null,
		};
		ctx.events.emit("subagent.done", { agentId, role: brief.role, brief, status: "failed", result });
		return result;
	} finally {
		release();
	}
}

/**
 * Fans a batch of briefs out concurrently (bounded by ctx.subAgentPool / the default cap) and
 * collects results keyed by agentId. A child that throws (rather than resolving with an
 * ok:false SubAgentResult) is recorded as `null` and noted — it never rejects the batch.
 */
export async function runSubAgents(
	briefs: SubAgentBrief[],
	ctx: RunContext,
): Promise<{ results: Map<string, SubAgentResult | null>; notes: string[] }> {
	const results = new Map<string, SubAgentResult | null>();
	const notes: string[] = [];

	await Promise.all(
		briefs.map(async (brief) => {
			const agentId = randomUUID();
			try {
				const result = await spawnSubAgent(brief, ctx, { agentId });
				results.set(agentId, result);
				if (!result.ok) notes.push(...result.notes.map((n) => `[${agentId}] ${n}`));
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				results.set(agentId, null);
				notes.push(`[${agentId}] subagent crashed: ${message}`);
			}
		}),
	);

	return { results, notes };
}
