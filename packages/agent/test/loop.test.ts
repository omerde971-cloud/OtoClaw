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

function makeCtx(options: {
	provider: StubProvider;
	mode?: "manual" | "auto";
	permissionChannel?: PermissionChannel;
	projectPolicy?: RunContext["projectPolicy"];
}): { ctx: RunContext; cwd: string; events: RecordingAgentEvents } {
	const cwd = mkdtempSync(join(tmpdir(), "otoclaw-agent-"));
	scratchDirs.push(cwd);
	const events = new RecordingAgentEvents();
	const ctx: RunContext = {
		session: { id: randomUUID(), cwd, mode: options.mode ?? "auto", createdAt: new Date().toISOString() },
		provider: options.provider,
		model: "stub/model",
		toolRegistry: createDefaultRegistry([fsWrite, shellRun]),
		toolContext: { cwd, sessionId: randomUUID() },
		permissionEngine: new PermissionEngine(),
		mode: options.mode ?? "auto",
		sessionOverrides: undefined,
		projectPolicy: options.projectPolicy ?? null,
		globalConfig: null,
		questionChannel: new StubQuestionChannel({ freeText: "proceed" }),
		permissionChannel: options.permissionChannel ?? { request: async () => "allow" },
		events,
	};
	return { ctx, cwd, events };
}

describe("runTask", () => {
	test("pipeline stages run in order and a stub-requested fs.write actually creates the file", async () => {
		const plan = {
			steps: [{ id: "step-1", description: "write hello.txt", kind: "tool", acceptance: ["hello.txt exists"] }],
		};
		const provider = new StubProvider([
			[{ delta: JSON.stringify(plan) }, { done: true }],
			[
				{
					toolCall: {
						id: "call_1",
						name: "fs.write",
						argsDelta: JSON.stringify({ path: "hello.txt", content: "hello world" }),
					},
				},
				{ done: true },
			],
			[{ delta: "done", done: true }],
		]);

		const { ctx, cwd, events } = makeCtx({ provider });
		const result = await runTask(ctx, { userText: "please write hello.txt for me" });

		expect(events.stages()).toEqual(["intake", "plan", "route", "execute", "review", "deliver"]);
		expect(result.review.passed).toBe(true);
		expect(existsSync(join(cwd, "hello.txt"))).toBe(true);
		expect(readFileSync(join(cwd, "hello.txt"), "utf8")).toBe("hello world");

		const toolStart = events.log.find((e) => e.event === "tool.start");
		expect(toolStart).toBeDefined();
	});

	test("a manual-mode permission request that is declined blocks the tool call and fails review", async () => {
		const plan = {
			steps: [{ id: "step-1", description: "write blocked.txt", kind: "tool", acceptance: [] }],
		};
		const provider = new StubProvider([
			[{ delta: JSON.stringify(plan) }, { done: true }],
			[
				{
					toolCall: {
						id: "call_2",
						name: "fs.write",
						argsDelta: JSON.stringify({ path: "blocked.txt", content: "nope" }),
					},
				},
				{ done: true },
			],
			[{ done: true }],
		]);

		const { ctx, cwd } = makeCtx({
			provider,
			mode: "manual",
			permissionChannel: { request: async () => "deny" },
		});
		const result = await runTask(ctx, { userText: "please write blocked.txt for me" });

		expect(result.review.passed).toBe(false);
		expect(result.stepResults[0]?.ok).toBe(false);
		expect(result.stepResults[0]?.notes.some((n) => n.includes("permission denied"))).toBe(true);
		expect(existsSync(join(cwd, "blocked.txt"))).toBe(false);
	});
});
