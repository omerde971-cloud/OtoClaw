import { describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PermissionEngine } from "@otoclaw/permission";
import { createDefaultRegistry, fsWrite, shellRun } from "@otoclaw/tools";
import { RecordingAgentEvents } from "../src/events";
import { runJudgePanel } from "../src/council";
import type { JudgeInput } from "../src/judge";
import type { PermissionChannel, QuestionAnswer, QuestionChannel, QuestionSpec, RunContext } from "../src/types";
import { StubProvider } from "./support/stub-provider";

function verdictJson(label: "good" | "bad", notes: string[] = []): { delta: string; done: true } {
	return { delta: JSON.stringify({ score: label === "good" ? 90 : 20, label, notes }), done: true };
}

class RecordingQuestionChannel implements QuestionChannel {
	readonly asked: QuestionSpec[] = [];
	constructor(private readonly answer: QuestionAnswer) {}
	async ask(spec: QuestionSpec): Promise<QuestionAnswer> {
		this.asked.push(spec);
		return this.answer;
	}
}

function makeCtx(provider: StubProvider): RunContext {
	const cwd = mkdtempSync(join(tmpdir(), "otoclaw-agent-council-"));
	const permissionChannel: PermissionChannel = { request: async () => "allow" };
	return {
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
		questionChannel: new RecordingQuestionChannel({}),
		permissionChannel,
		events: new RecordingAgentEvents(),
	};
}

function makeInput(ctx: RunContext): JudgeInput {
	return {
		artifact: { kind: "code", description: "the widget", ref: "step-1" },
		rubric: ["derlenir/çalışır mı"],
		ctx,
	};
}

describe("runJudgePanel", () => {
	test("2 good, 1 bad: majority vote is good", async () => {
		const provider = new StubProvider([
			[verdictJson("good", ["correctness: fine"])],
			[verdictJson("good", ["functional: fine"])],
			[verdictJson("bad", ["aesthetics: ugly"])],
		]);
		const ctx = makeCtx(provider);

		const verdict = await runJudgePanel(["correctness", "functional", "aesthetics"], makeInput(ctx));

		expect(verdict.label).toBe("good");
		expect(verdict.targetId).toBe("step-1");
		expect(verdict.notes).toEqual([
			"[correctness]: correctness: fine",
			"[functional]: functional: fine",
			"[aesthetics]: aesthetics: ugly",
		]);
	});

	test("1 good, 2 bad: majority vote is bad", async () => {
		const provider = new StubProvider([
			[verdictJson("good", ["correctness: fine"])],
			[verdictJson("bad", ["functional: broken"])],
			[verdictJson("bad", ["aesthetics: ugly"])],
		]);
		const ctx = makeCtx(provider);

		const verdict = await runJudgePanel(["correctness", "functional", "aesthetics"], makeInput(ctx));

		expect(verdict.label).toBe("bad");
	});

	test("even panel tied 1 good / 1 bad resolves to bad (safe-side tie-break)", async () => {
		const provider = new StubProvider([[verdictJson("good", ["ok"])], [verdictJson("bad", ["not ok"])]]);
		const ctx = makeCtx(provider);

		const verdict = await runJudgePanel(["correctness", "functional"], makeInput(ctx));

		expect(verdict.label).toBe("bad");
	});
});
