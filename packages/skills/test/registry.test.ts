import { describe, expect, test } from "bun:test";
import { SkillRegistry } from "../src/registry";
import type { Skill } from "../src/types";

function makeSkill(overrides: Partial<Skill["manifest"]> = {}): Skill {
	return {
		manifest: {
			name: "frontend-aesthetics",
			description: "Design and polish frontend UI for visual quality and taste.",
			triggers: ["frontend", "ui design"],
			version: "0.1.0",
			source: "local",
			...overrides,
		},
		instructions: "# Frontend Aesthetics\n",
	};
}

describe("SkillRegistry", () => {
	test("match() returns skills whose triggers appear in the task text, case-insensitively", () => {
		const registry = new SkillRegistry();
		registry.register(makeSkill());

		expect(registry.match("Please improve the FRONTEND for this page").map((s) => s.manifest.name)).toEqual([
			"frontend-aesthetics",
		]);
	});

	test("match() returns no skills when no trigger substring is present", () => {
		const registry = new SkillRegistry();
		registry.register(makeSkill());

		expect(registry.match("fix the database migration")).toEqual([]);
	});

	test("match() can return multiple skills for one task", () => {
		const registry = new SkillRegistry();
		registry.register(makeSkill());
		registry.register(
			makeSkill({ name: "git-workflow", triggers: ["git", "commit"], description: "git hygiene" }),
		);

		const matched = registry.match("polish the frontend then commit the change").map((s) => s.manifest.name);
		expect(matched.sort()).toEqual(["frontend-aesthetics", "git-workflow"]);
	});

	test("has()/get()/unregister() manage the underlying index", () => {
		const registry = new SkillRegistry();
		const skill = makeSkill();
		registry.register(skill);

		expect(registry.has("frontend-aesthetics")).toBe(true);
		expect(registry.get("frontend-aesthetics")).toEqual(skill);

		registry.unregister("frontend-aesthetics");
		expect(registry.has("frontend-aesthetics")).toBe(false);
		expect(registry.list()).toEqual([]);
	});
});
