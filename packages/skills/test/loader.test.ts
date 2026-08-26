import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { loadSkillFromDir, loadSkillsFromDir } from "../src/loader";
import { SkillRegistry } from "../src/registry";

const FIXTURES_DIR = join(import.meta.dir, "fixtures");

describe("loadSkillFromDir", () => {
	test("reads skill.json + SKILL.md into a Skill", async () => {
		const skill = await loadSkillFromDir(join(FIXTURES_DIR, "frontend-aesthetics"));

		expect(skill.manifest.name).toBe("frontend-aesthetics");
		expect(skill.manifest.triggers).toContain("frontend");
		expect(skill.instructions).toContain("Frontend Aesthetics");
	});

	test("rejects a folder whose skill.json is missing required manifest fields", async () => {
		await expect(loadSkillFromDir(join(FIXTURES_DIR, "broken-skill"))).rejects.toThrow();
	});

	test("rejects a folder with no skill.json at all", async () => {
		await expect(loadSkillFromDir(join(FIXTURES_DIR, "does-not-exist"))).rejects.toThrow();
	});
});

describe("loadSkillsFromDir", () => {
	test("loads every valid skill folder and skips invalid ones", async () => {
		const skills = await loadSkillsFromDir(FIXTURES_DIR);
		const names = skills.map((s) => s.manifest.name).sort();

		expect(names).toEqual(["frontend-aesthetics", "git-workflow"]);
	});

	test("returns an empty array for a directory that does not exist", async () => {
		expect(await loadSkillsFromDir(join(FIXTURES_DIR, "nope"))).toEqual([]);
	});

	test("loaded skills work end-to-end with SkillRegistry.match()", async () => {
		const registry = new SkillRegistry();
		for (const skill of await loadSkillsFromDir(FIXTURES_DIR)) {
			registry.register(skill);
		}

		expect(registry.match("open a pull request for this branch").map((s) => s.manifest.name)).toEqual([
			"git-workflow",
		]);
	});
});
