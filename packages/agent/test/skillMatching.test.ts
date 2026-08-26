import { describe, expect, test } from "bun:test";
import { matchDesignSkill } from "../src/skillMatching";
import type { PlanStep, SkillRegistryHandle } from "../src/types";

function makeStep(description: string): PlanStep {
	return { id: "step-1", description, kind: "tool", acceptance: [] };
}

const tasteSkill = {
	manifest: {
		name: "taste-skill",
		description: "Anti-slop frontend skill for landing pages, ui design, tasarım, and redesigns.",
	},
};

const dbSkill = {
	manifest: {
		name: "db-migration-skill",
		description: "Helps write and review SQL database migrations.",
	},
};

function makeRegistry(candidates: Array<{ manifest: { name: string; description: string } }>): SkillRegistryHandle {
	return {
		match: (taskText: string) =>
			candidates.filter((s) =>
				s.manifest.description
					.toLowerCase()
					.split(/\W+/)
					.some((word) => word.length > 0 && taskText.toLowerCase().includes(word)),
			),
	};
}

describe("matchDesignSkill", () => {
	test("returns null when no skillRegistry is provided", () => {
		const step = makeStep("tasarım yap, UI güzelleştir");
		expect(matchDesignSkill(step, undefined)).toBeNull();
	});

	test("returns null when no registered skill matches the step", () => {
		const registry = makeRegistry([tasteSkill, dbSkill]);
		const step = makeStep("run tests");
		expect(matchDesignSkill(step, registry)).toBeNull();
	});

	test("picks the design skill for a design/UI step and names it in the hint", () => {
		const registry = makeRegistry([tasteSkill, dbSkill]);
		const step = makeStep("Bu adımda landing page için tasarım ve ui iyileştirmesi yap");
		const hint = matchDesignSkill(step, registry);
		expect(hint).not.toBeNull();
		expect(hint).toContain("taste-skill");
	});

	test("does not match the design skill for an unrelated step", () => {
		const registry = makeRegistry([tasteSkill, dbSkill]);
		const step = makeStep("write a SQL migration for the users table");
		const hint = matchDesignSkill(step, registry);
		expect(hint).toContain("db-migration-skill");
		expect(hint).not.toContain("taste-skill");
	});
});
