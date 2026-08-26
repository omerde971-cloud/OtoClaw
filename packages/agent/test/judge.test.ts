import { describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PermissionEngine } from "@otoclaw/permission";
import { createDefaultRegistry, fsWrite, shellRun } from "@otoclaw/tools";
import { RecordingAgentEvents } from "../src/events";
import { judgeAndRepair } from "../src/loop";
import { judge } from "../src/judge";
import type { PermissionChannel, PlanStep, QuestionAnswer, QuestionChannel, QuestionSpec, RunContext } from "../src/types";
import { StubProvider } from "./support/stub-provider";

function verdictJson(label: "good" | "bad", notes: string[] = []): { delta: string; done: true } {
	return { delta: JSON.stringify({ score: label === "good" ? 90 : 20, label, notes }), done: true };
}

function makeCtx(provider: StubProvider, questionChannel: QuestionChannel): RunContext {
	const cwd = mkdtempSync(join(tmpdir(), "otoclaw-agent-judge-"));
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
		questionChannel,
		permissionChannel,
		events: new RecordingAgentEvents(),
	};
}

class RecordingQuestionChannel implements QuestionChannel {
	readonly asked: QuestionSpec[] = [];
	constructor(private readonly answer: QuestionAnswer) {}
	async ask(spec: QuestionSpec): Promise<QuestionAnswer> {
		this.asked.push(spec);
		return this.answer;
	}
}

const step: PlanStep = { id: "step-1", description: "implement the widget", kind: "code", acceptance: [] };

describe("judge", () => {
	test("parses a well-formed verdict", async () => {
		const provider = new StubProvider([[verdictJson("good", ["looks fine"])]]);
		const questionChannel = new RecordingQuestionChannel({});
		const ctx = makeCtx(provider, questionChannel);

		const verdict = await judge({
			artifact: { kind: "code", description: "the widget", ref: "step-1" },
			rubric: ["derlenir/çalışır mı"],
			ctx,
		});

		expect(verdict.label).toBe("good");
		expect(verdict.score).toBe(90);
		expect(verdict.notes).toEqual(["looks fine"]);
		expect(verdict.targetId).toBe("step-1");
	});

	test("falls back to a safe verdict instead of crashing on a malformed response", async () => {
		const provider = new StubProvider([[{ delta: "not json at all", done: true }]]);
		const questionChannel = new RecordingQuestionChannel({});
		const ctx = makeCtx(provider, questionChannel);

		const verdict = await judge({
			artifact: { kind: "text", description: "some output", ref: "step-2" },
			rubric: [],
			ctx,
		});

		expect(verdict.label).toBe("good");
		expect(verdict.notes.length).toBeGreaterThan(0);
	});
});

describe("judgeAndRepair", () => {
	test("bad, bad, then good: repairs twice, re-judges each time, and stops once good — never asks a question", async () => {
		const provider = new StubProvider([
			[verdictJson("bad", ["missing error handling"])],
			[{ delta: "applied a fix", done: true }],
			[verdictJson("bad", ["still missing a case"])],
			[{ delta: "applied another fix", done: true }],
			[verdictJson("good", ["looks solid now"])],
		]);
		const questionChannel = new RecordingQuestionChannel({});
		const ctx = makeCtx(provider, questionChannel);

		const outcome = await judgeAndRepair(step, ctx);

		expect(outcome.accepted).toBe(true);
		expect(outcome.verdicts.map((v) => v.label)).toEqual(["bad", "bad", "good"]);
		expect(questionChannel.asked).toHaveLength(0);
		expect(provider.requests.length).toBe(5);
	});

	test("bad after the repair cap (2 repairs) falls back to a button question; 'İptal' rejects the step", async () => {
		const provider = new StubProvider([
			[verdictJson("bad", ["note 1"])],
			[{ delta: "fix attempt 1", done: true }],
			[verdictJson("bad", ["note 2"])],
			[{ delta: "fix attempt 2", done: true }],
			[verdictJson("bad", ["note 3"])],
		]);
		const questionChannel = new RecordingQuestionChannel({ optionId: "cancel" });
		const ctx = makeCtx(provider, questionChannel);

		const outcome = await judgeAndRepair(step, ctx);

		expect(outcome.verdicts).toHaveLength(3);
		expect(outcome.verdicts.every((v) => v.label === "bad")).toBe(true);
		expect(questionChannel.asked).toHaveLength(1);
		expect(questionChannel.asked[0]?.options.map((o) => o.id)).toEqual(["accept", "cancel", "manual"]);
		expect(outcome.accepted).toBe(false);
		// exactly 2 repair fix-turns happened (no third repair after the cap is hit)
		expect(provider.requests.length).toBe(5);
	});

	test("bad after the repair cap with 'Kabul et' accepts the step despite the bad verdict", async () => {
		const provider = new StubProvider([
			[verdictJson("bad", ["note 1"])],
			[{ delta: "fix attempt 1", done: true }],
			[verdictJson("bad", ["note 2"])],
			[{ delta: "fix attempt 2", done: true }],
			[verdictJson("bad", ["note 3"])],
		]);
		const questionChannel = new RecordingQuestionChannel({ optionId: "accept" });
		const ctx = makeCtx(provider, questionChannel);

		const outcome = await judgeAndRepair(step, ctx);

		expect(outcome.accepted).toBe(true);
		expect(questionChannel.asked).toHaveLength(1);
	});
});
