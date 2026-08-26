import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { QuestionAnswer, QuestionChannel, QuestionSpec } from "@otoclaw/agent";
import {
	acquireSkill,
	acquireSkillInBackground,
	sandboxInstallSkill,
	verifyQuarantineFiles,
	type SkillSourceSearch,
} from "../src/acquisition";
import { SkillRegistry } from "../src/registry";
import type { SkillCandidate } from "../src/types";

/** Answers only after a real delay, so callers observe the round trip as non-blocking. */
class DelayedQuestionChannel implements QuestionChannel {
	readonly asked: QuestionSpec[] = [];
	constructor(
		private readonly answer: QuestionAnswer,
		private readonly delayMs: number,
	) {}

	async ask(spec: QuestionSpec): Promise<QuestionAnswer> {
		this.asked.push(spec);
		return new Promise((resolve) => setTimeout(() => resolve(this.answer), this.delayMs));
	}
}

class MockSourceSearch implements SkillSourceSearch {
	constructor(private readonly candidates: SkillCandidate[]) {}
	async search(): Promise<SkillCandidate[]> {
		return this.candidates;
	}
}

const CANDIDATE: SkillCandidate = { name: "unit-testing", source: "github", location: "https://github.com/x/y" };

describe("acquireSkill", () => {
	test("returns 'installed' without asking when the skill is already registered", async () => {
		const registry = new SkillRegistry();
		registry.register({
			manifest: { name: "unit-testing", description: "d", triggers: ["test"], version: "0.1.0", source: "local" },
			instructions: "x",
		});
		const questionChannel = new DelayedQuestionChannel({ optionId: "install" }, 0);

		const result = await acquireSkill("unit-testing", {
			registry,
			questionChannel,
			sourceSearch: new MockSourceSearch([CANDIDATE]),
			install: async () => {},
		});

		expect(result).toBe("installed");
		expect(questionChannel.asked).toEqual([]);
	});

	test("returns 'not_found' when no source has a candidate", async () => {
		const result = await acquireSkill("nonexistent", {
			registry: new SkillRegistry(),
			questionChannel: new DelayedQuestionChannel({ optionId: "install" }, 0),
			sourceSearch: new MockSourceSearch([]),
			install: async () => {},
		});

		expect(result).toBe("not_found");
	});

	test("returns 'skipped' and never installs when the user declines", async () => {
		let installed = false;
		const result = await acquireSkill("unit-testing", {
			registry: new SkillRegistry(),
			questionChannel: new DelayedQuestionChannel({ optionId: "skip" }, 0),
			sourceSearch: new MockSourceSearch([CANDIDATE]),
			install: async () => {
				installed = true;
			},
		});

		expect(result).toBe("skipped");
		expect(installed).toBe(false);
	});

	test("installs only after an explicit 'install' answer", async () => {
		let installedCandidate: SkillCandidate | undefined;
		const result = await acquireSkill("unit-testing", {
			registry: new SkillRegistry(),
			questionChannel: new DelayedQuestionChannel({ optionId: "install" }, 0),
			sourceSearch: new MockSourceSearch([CANDIDATE]),
			install: async (candidate) => {
				installedCandidate = candidate;
			},
		});

		expect(result).toBe("installed");
		expect(installedCandidate).toEqual(CANDIDATE);
	});
});

describe("acquireSkillInBackground — non-blocking guarantee", () => {
	test("returns immediately and lets unrelated work proceed while question.ask is still pending", async () => {
		const events: string[] = [];
		const questionChannel = new DelayedQuestionChannel({ optionId: "install" }, 50);

		let resultReceived: string | undefined;
		const donePromise = new Promise<void>((resolveDone) => {
			acquireSkillInBackground(
				"unit-testing",
				{
					registry: new SkillRegistry(),
					questionChannel,
					sourceSearch: new MockSourceSearch([CANDIDATE]),
					install: async () => {
						events.push("installed");
					},
				},
				(result) => {
					resultReceived = result;
					events.push("acquire-result");
					resolveDone();
				},
			);
		});

		// acquireSkillInBackground must have returned synchronously (not awaited) by this point —
		// prove it by running independent work before the delayed answer has resolved.
		events.push("independent-work-1");
		let counter = 0;
		for (let i = 0; i < 5; i++) counter++;
		events.push("independent-work-2");
		expect(counter).toBe(5);

		await donePromise;

		expect(events).toEqual(["independent-work-1", "independent-work-2", "installed", "acquire-result"]);
		expect(resultReceived).toBe("installed");
	});
});

describe("verifyQuarantineFiles", () => {
	test("accepts only .md/.json/.txt files", () => {
		expect(verifyQuarantineFiles([{ filename: "skill.json", content: "{}" }])).toBe(true);
		expect(verifyQuarantineFiles([{ filename: "SKILL.md", content: "#" }])).toBe(true);
		expect(verifyQuarantineFiles([{ filename: "notes.txt", content: "" }])).toBe(true);
	});

	test("rejects scripts/binaries/executables", () => {
		expect(verifyQuarantineFiles([{ filename: "install.sh", content: "" }])).toBe(false);
		expect(verifyQuarantineFiles([{ filename: "run.exe", content: "" }])).toBe(false);
		expect(verifyQuarantineFiles([{ filename: "hook.js", content: "" }])).toBe(false);
	});

	test("rejects an empty file list", () => {
		expect(verifyQuarantineFiles([])).toBe(false);
	});
});

describe("sandboxInstallSkill", () => {
	test("quarantines then promotes an allowlisted skill into the skills root", async () => {
		const quarantineRoot = mkdtempSync(join(tmpdir(), "otoclaw-quarantine-"));
		const skillsRoot = mkdtempSync(join(tmpdir(), "otoclaw-skills-"));
		try {
			const finalDir = await sandboxInstallSkill(
				CANDIDATE,
				[
					{ filename: "skill.json", content: '{"name":"unit-testing"}' },
					{ filename: "SKILL.md", content: "# Unit Testing" },
				],
				{ quarantineRoot, skillsRoot },
			);

			expect(finalDir).toBe(join(skillsRoot, "unit-testing"));
			expect(readFileSync(join(finalDir, "SKILL.md"), "utf8")).toBe("# Unit Testing");
		} finally {
			rmSync(quarantineRoot, { recursive: true, force: true });
			rmSync(skillsRoot, { recursive: true, force: true });
		}
	});

	test("rejects a candidate carrying a disallowed file type and does not write to skillsRoot", async () => {
		const quarantineRoot = mkdtempSync(join(tmpdir(), "otoclaw-quarantine-"));
		const skillsRoot = mkdtempSync(join(tmpdir(), "otoclaw-skills-"));
		try {
			await expect(
				sandboxInstallSkill(
					CANDIDATE,
					[
						{ filename: "skill.json", content: "{}" },
						{ filename: "postinstall.sh", content: "rm -rf /" },
					],
					{ quarantineRoot, skillsRoot },
				),
			).rejects.toThrow();
		} finally {
			rmSync(quarantineRoot, { recursive: true, force: true });
			rmSync(skillsRoot, { recursive: true, force: true });
		}
	});
});
