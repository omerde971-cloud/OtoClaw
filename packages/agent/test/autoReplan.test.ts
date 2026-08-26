import { afterAll, describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PermissionEngine } from "@otoclaw/permission";
import { createDefaultRegistry, fsWrite, shellRun } from "@otoclaw/tools";
import { RecordingAgentEvents } from "../src/events";
import { StubQuestionChannel } from "../src/intake";
import { runTask } from "../src/loop";
import type { PermissionChannel, RunContext } from "../src/types";
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

/** Denies shell.run (mirroring a user who won't approve a risky shell command) but allows everything else. */
const denyShellPermissionChannel: PermissionChannel = {
	request: async (input) => (input.toolName === "shell.run" ? "deny" : "allow"),
};

/** Denies every tool call, so a proposed corrective step can never succeed either. */
const denyAllPermissionChannel: PermissionChannel = {
	request: async () => "deny",
};

function makeCtx(options: {
	provider: StubProvider;
	mode: "manual" | "auto";
	permissionChannel: PermissionChannel;
}): { ctx: RunContext; cwd: string; events: RecordingAgentEvents } {
	const cwd = mkdtempSync(join(tmpdir(), "otoclaw-agent-replan-"));
	scratchDirs.push(cwd);
	const events = new RecordingAgentEvents();
	const ctx: RunContext = {
		session: { id: randomUUID(), cwd, mode: options.mode, createdAt: new Date().toISOString() },
		provider: options.provider,
		model: "stub/model",
		toolRegistry: createDefaultRegistry([fsWrite, shellRun]),
		toolContext: { cwd, sessionId: randomUUID() },
		permissionEngine: new PermissionEngine(),
		mode: options.mode,
		sessionOverrides: undefined,
		projectPolicy: null,
		globalConfig: null,
		questionChannel: new StubQuestionChannel({ freeText: "proceed" }),
		permissionChannel: options.permissionChannel,
		events,
	};
	return { ctx, cwd, events };
}

const originalPlan = {
	steps: [{ id: "step-1", description: "run the risky shell command", kind: "tool", acceptance: [] }],
};

const correctivePlan = {
	steps: [{ id: "fix-1", description: "write a recovery file instead", kind: "tool", acceptance: [] }],
};

describe("auto-mode plan-level self-repair", () => {
	test("auto mode: an unresolved step triggers one replan round, and a successful corrective step delivers the run", async () => {
		const provider = new StubProvider([
			[{ delta: JSON.stringify(originalPlan) }, { done: true }],
			[
				{ toolCall: { id: "call_1", name: "shell.run", argsDelta: JSON.stringify({ cmd: "npm test" }) } },
				{ done: true },
			],
			[{ delta: "can't run that", done: true }],
			[{ delta: JSON.stringify(correctivePlan) }, { done: true }],
			[
				{
					toolCall: {
						id: "call_2",
						name: "fs.write",
						argsDelta: JSON.stringify({ path: "recovered.txt", content: "ok" }),
					},
				},
				{ done: true },
			],
			[{ delta: "done", done: true }],
			[{ delta: JSON.stringify({ score: 90, label: "good", notes: [] }), done: true }],
		]);

		const { ctx, cwd, events } = makeCtx({ provider, mode: "auto", permissionChannel: denyShellPermissionChannel });
		const result = await runTask(ctx, { userText: "run tests and recover if they can't run" });

		expect(result.autoReplanAttempted).toBe(true);
		expect(result.review.passed).toBe(true);
		expect(result.stepResults).toHaveLength(2);
		expect(result.stepResults[0]?.stepId).toBe("step-1");
		expect(result.stepResults[0]?.ok).toBe(true);
		expect(result.stepResults[0]?.notes.some((n) => n.includes("resolved via auto-replan"))).toBe(true);
		expect(result.stepResults[1]?.stepId).toBe("fix-1");
		expect(result.stepResults[1]?.ok).toBe(true);
		expect(existsSync(join(cwd, "recovered.txt"))).toBe(true);
		expect(readFileSync(join(cwd, "recovered.txt"), "utf8")).toBe("ok");
		expect(events.stages()).toEqual(["intake", "plan", "route", "execute", "auto-replan", "review", "deliver"]);
	});

	test("manual mode: the same unresolved-step scenario does NOT trigger a replan (existing behavior is preserved)", async () => {
		const provider = new StubProvider([
			[{ delta: JSON.stringify(originalPlan) }, { done: true }],
			[
				{ toolCall: { id: "call_1", name: "shell.run", argsDelta: JSON.stringify({ cmd: "npm test" }) } },
				{ done: true },
			],
			[{ delta: "can't run that", done: true }],
		]);

		const { ctx, events } = makeCtx({ provider, mode: "manual", permissionChannel: denyShellPermissionChannel });
		const result = await runTask(ctx, { userText: "run tests and recover if they can't run" });

		expect(result.autoReplanAttempted).toBe(false);
		expect(result.review.passed).toBe(false);
		expect(result.stepResults).toHaveLength(1);
		expect(events.stages()).not.toContain("auto-replan");
		expect(provider.requests).toHaveLength(3);
	});

	test("auto mode: a replan round that also fails does not loop again (bounded to a single attempt)", async () => {
		const provider = new StubProvider([
			[{ delta: JSON.stringify(originalPlan) }, { done: true }],
			[
				{ toolCall: { id: "call_1", name: "shell.run", argsDelta: JSON.stringify({ cmd: "npm test" }) } },
				{ done: true },
			],
			[{ delta: "can't run that", done: true }],
			[{ delta: JSON.stringify(correctivePlan) }, { done: true }],
			[
				{
					toolCall: {
						id: "call_2",
						name: "fs.write",
						argsDelta: JSON.stringify({ path: "recovered.txt", content: "ok" }),
					},
				},
				{ done: true },
			],
			[{ delta: "still can't", done: true }],
		]);

		const { ctx } = makeCtx({ provider, mode: "auto", permissionChannel: denyAllPermissionChannel });
		const result = await runTask(ctx, { userText: "run tests and recover if they can't run" });

		expect(result.autoReplanAttempted).toBe(true);
		expect(result.review.passed).toBe(false);
		expect(result.stepResults).toHaveLength(2);
		expect(result.stepResults[0]?.ok).toBe(false);
		expect(result.stepResults[1]?.ok).toBe(false);
		// exactly the 6 scripted calls (initial plan + step turn + one replan round) — no second replan round.
		expect(provider.requests).toHaveLength(6);
	});
});
