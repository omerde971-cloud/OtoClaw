import { afterAll, describe, expect, test } from "bun:test";
import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ChatChunk, ModelCapabilities, ModelInfo, Provider } from "@otoclaw/providers";
import { PermissionEngine } from "@otoclaw/permission";
import { createDefaultRegistry, fsWrite } from "@otoclaw/tools";
import { RecordingAgentEvents } from "../src/events";
import { StubQuestionChannel } from "../src/intake";
import { buildBrief, DEFAULT_SUBAGENT_BUDGET, runSubAgents, Semaphore, spawnSubAgent } from "../src/subagents";
import type { PlanStep, RunContext, SubAgentBrief } from "../src/types";
import { discardWorktree } from "../src/worktree";
import { StubProvider } from "./support/stub-provider";

const scratchDirs: string[] = [];
afterAll(() => {
	for (const dir of scratchDirs.splice(0)) {
		try {
			rmSync(dir, { recursive: true, force: true });
		} catch {
			// best-effort cleanup
		}
	}
});

function scratchDir(prefix: string): string {
	const dir = mkdtempSync(join(tmpdir(), prefix));
	scratchDirs.push(dir);
	return dir;
}

function initRepo(prefix: string): string {
	const dir = scratchDir(prefix);
	execSync("git init -q", { cwd: dir });
	execSync('git config user.email "test@otoclaw.dev"', { cwd: dir });
	execSync('git config user.name "OtoClaw Test"', { cwd: dir });
	writeFileSync(join(dir, "README.md"), "hello\n");
	execSync("git add -A", { cwd: dir });
	execSync('git commit -q -m "init"', { cwd: dir });
	return dir;
}

function makeCtx(provider: Provider, cwd: string): RunContext {
	return {
		session: { id: randomUUID(), cwd, mode: "auto", createdAt: new Date().toISOString() },
		provider,
		model: "stub/model",
		toolRegistry: createDefaultRegistry([fsWrite]),
		toolContext: { cwd, sessionId: randomUUID() },
		permissionEngine: new PermissionEngine(),
		mode: "auto",
		sessionOverrides: undefined,
		projectPolicy: null,
		globalConfig: null,
		questionChannel: new StubQuestionChannel({ freeText: "proceed" }),
		permissionChannel: { request: async () => "allow" },
		events: new RecordingAgentEvents(),
	};
}

describe("buildBrief", () => {
	test("is a pure function of the step — no LLM call", () => {
		const step: PlanStep = { id: "s1", description: "research X", kind: "tool", acceptance: ["found X"], role: "researcher" };
		expect(buildBrief(step)).toEqual({
			role: "researcher",
			goal: "research X",
			inputs: {},
			constraints: [],
			acceptance: ["found X"],
			budget: { ...DEFAULT_SUBAGENT_BUDGET },
		});
	});

	test("defaults role to coder when the step has none, and an explicit role wins over both", () => {
		const step: PlanStep = { id: "s1", description: "do it", kind: "tool", acceptance: [] };
		expect(buildBrief(step).role).toBe("coder");
		expect(buildBrief(step, "tester").role).toBe("tester");
	});
});

/** Counts overlapping in-flight chat() calls so the concurrency cap can be proven with a counter. */
class ConcurrencyProvider implements Provider {
	readonly id = "concurrency-stub";
	active = 0;
	peak = 0;
	calls = 0;

	async listModels(): Promise<ModelInfo[]> {
		return [];
	}

	capabilities(): ModelCapabilities {
		return { tools: true, vision: false, ctx: 8000 };
	}

	chat(): AsyncIterable<ChatChunk> {
		this.calls++;
		const self = this;
		return (async function* () {
			self.active++;
			self.peak = Math.max(self.peak, self.active);
			await new Promise((resolve) => setTimeout(resolve, 15));
			self.active--;
			yield { delta: "ok", usage: { in: 1, out: 1 }, done: true };
		})();
	}
}

describe("spawnSubAgent — concurrency cap", () => {
	test("10 concurrent spawns through a pool of 2 never run more than 2 at once", async () => {
		const provider = new ConcurrencyProvider();
		const cwd = scratchDir("otoclaw-subagent-cc-");
		const ctx = makeCtx(provider, cwd);
		ctx.subAgentPool = new Semaphore(2);

		const briefs: SubAgentBrief[] = Array.from({ length: 10 }, (_, i) => ({
			role: "researcher",
			goal: `task ${i}`,
			inputs: {},
			constraints: [],
			acceptance: [],
			budget: { tokens: 100_000, steps: 3 },
		}));

		const { results } = await runSubAgents(briefs, ctx);

		expect(results.size).toBe(10);
		expect(provider.calls).toBe(10);
		expect(provider.peak).toBeLessThanOrEqual(2);
	});
});

describe("spawnSubAgent — budget", () => {
	test("budget.steps=1 executes the first tool-turn but never allows a second model call", async () => {
		const provider = new StubProvider([
			[
				{
					toolCall: { id: "call1", name: "fs.write", argsDelta: JSON.stringify({ path: "out.txt", content: "x" }) },
				},
				{ usage: { in: 10, out: 5 } },
				{ done: true },
			],
			[{ delta: "this second turn must never run", done: true }],
		]);
		const cwd = scratchDir("otoclaw-subagent-budget-");
		const ctx = makeCtx(provider, cwd);

		const brief: SubAgentBrief = {
			role: "researcher",
			goal: "write out.txt",
			inputs: {},
			constraints: [],
			acceptance: [],
			budget: { tokens: 1_000_000, steps: 1 },
		};

		const result = await spawnSubAgent(brief, ctx);

		expect(provider.requests.length).toBe(1);
		expect(result.ok).toBe(false);
		expect(result.notes.some((n) => n.includes("budget_exceeded"))).toBe(true);
		expect(existsSync(join(cwd, "out.txt"))).toBe(true);
	});

	test("exceeding the token budget fails the run even when step budget remains", async () => {
		const provider = new StubProvider([[{ delta: "large output", usage: { in: 999_999, out: 1 }, done: true }]]);
		const cwd = scratchDir("otoclaw-subagent-tokens-");
		const ctx = makeCtx(provider, cwd);

		const brief: SubAgentBrief = {
			role: "researcher",
			goal: "g",
			inputs: {},
			constraints: [],
			acceptance: [],
			budget: { tokens: 100, steps: 5 },
		};

		const result = await spawnSubAgent(brief, ctx);

		expect(result.ok).toBe(false);
		expect(result.notes.some((n) => n.includes("budget_exceeded"))).toBe(true);
	});
});

describe("spawnSubAgent — worktree isolation", () => {
	test("a coder sub-agent's changes land in its worktree, not the main repo, and are never merged", async () => {
		const repo = initRepo("otoclaw-subagent-repo-");
		const provider = new StubProvider([
			[
				{
					toolCall: {
						id: "call1",
						name: "fs.write",
						argsDelta: JSON.stringify({ path: "coder-output.txt", content: "done" }),
					},
				},
				{ done: true },
			],
			[{ delta: "finished", done: true }],
		]);
		const ctx = makeCtx(provider, repo);

		const brief: SubAgentBrief = {
			role: "coder",
			goal: "add coder-output.txt",
			inputs: {},
			constraints: [],
			acceptance: [],
			budget: { tokens: 100_000, steps: 5 },
		};

		const result = await spawnSubAgent(brief, ctx);

		expect(result.ok).toBe(true);
		expect(result.worktree).not.toBeNull();
		expect(result.worktree?.diff).toContain("coder-output.txt");
		expect(existsSync(join(repo, "coder-output.txt"))).toBe(false);
		expect(existsSync(join(result.worktree?.path ?? "", "coder-output.txt"))).toBe(true);

		if (result.worktree) {
			await discardWorktree({ path: result.worktree.path, branch: result.worktree.branch, repoRoot: repo });
		}
	});
});

describe("runSubAgents — partial failure isolation", () => {
	test("a child that throws is recorded as null with a note, and never sinks the parent Promise.all", async () => {
		class ThrowingPool extends Semaphore {
			constructor() {
				super(1);
			}
			override acquire(): Promise<() => void> {
				return Promise.reject(new Error("pool broken"));
			}
		}

		const provider = new StubProvider([[{ delta: "ok", done: true }]]);
		const cwd = scratchDir("otoclaw-subagent-crash-");
		const ctx = makeCtx(provider, cwd);
		ctx.subAgentPool = new ThrowingPool();

		const brief: SubAgentBrief = {
			role: "researcher",
			goal: "g",
			inputs: {},
			constraints: [],
			acceptance: [],
			budget: { tokens: 1000, steps: 1 },
		};

		const { results, notes } = await runSubAgents([brief], ctx);

		expect(results.size).toBe(1);
		expect([...results.values()][0]).toBeNull();
		expect(notes.some((n) => n.includes("subagent crashed"))).toBe(true);
	});
});
