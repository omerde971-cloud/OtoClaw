import { afterAll, describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PermissionEngine } from "@otoclaw/permission";
import { createDefaultRegistry, fsWrite, shellRun } from "@otoclaw/tools";
import { codeTestDebug } from "../src/codeTestDebug";
import { RecordingAgentEvents } from "../src/events";
import { StubQuestionChannel } from "../src/intake";
import type { PlanStep, RunContext } from "../src/types";
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

function makeCtx(provider: StubProvider): { ctx: RunContext; cwd: string } {
	const cwd = mkdtempSync(join(tmpdir(), "otoclaw-agent-ctd-"));
	scratchDirs.push(cwd);
	const ctx: RunContext = {
		session: { id: randomUUID(), cwd, mode: "auto", createdAt: new Date().toISOString() },
		provider,
		model: "stub/model",
		toolRegistry: createDefaultRegistry([fsWrite, shellRun]),
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
	return { ctx, cwd };
}

const step: PlanStep = { id: "step-1", description: "make the marker file exist", kind: "code", acceptance: [] };

describe("codeTestDebug", () => {
	test("first attempt fails, the model's fix (a real fs.write) makes the second attempt pass", async () => {
		const provider = new StubProvider([
			[
				{
					toolCall: {
						id: "fix_1",
						name: "fs.write",
						argsDelta: JSON.stringify({ path: "marker.txt", content: "present" }),
					},
				},
				{ done: true },
			],
			[{ delta: "fixed it", done: true }],
		]);
		const { ctx, cwd } = makeCtx(provider);
		const testCommand = "if exist marker.txt (exit 0) else (exit 1)";

		const result = await codeTestDebug({ step, testCommand, ctx });

		expect(result.resolved).toBe(true);
		expect(result.attempts).toBe(2);
		expect(result.notes).toEqual([]);
		expect(existsSync(join(cwd, "marker.txt"))).toBe(true);
	});

	test("exhausting all retries reports an unresolved failure without throwing", async () => {
		const provider = new StubProvider([[{ delta: "trying", done: true }], [{ delta: "trying again", done: true }]]);
		const { ctx } = makeCtx(provider);

		const result = await codeTestDebug({ step, testCommand: "exit 1", ctx });

		expect(result.resolved).toBe(false);
		expect(result.attempts).toBe(3);
		expect(result.notes[0]).toMatch(/unresolved failure after 3 attempts/);
	});
});
