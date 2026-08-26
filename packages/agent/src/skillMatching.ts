import type { PlanStep, SkillRegistryHandle } from "./types";

type MatchedSkill = ReturnType<SkillRegistryHandle["match"]>[number];

function tokenize(text: string): string[] {
	return text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

/** Ranks a skill by how many of its description words also appear in the step's description. */
function overlapScore(taskWords: Set<string>, skill: MatchedSkill): number {
	return tokenize(skill.manifest.description).filter((word) => taskWords.has(word)).length;
}

/**
 * Finds the best-matching skill (typically a design/UI skill) registered for `step` via
 * `skillRegistry.match()`, and returns a short instruction prefix telling the model to load
 * and follow it. Returns null when there is no registry or no skill matches the step.
 */
export function matchDesignSkill(step: PlanStep, skillRegistry?: SkillRegistryHandle): string | null {
	if (!skillRegistry) return null;

	const matches = skillRegistry.match(step.description);
	if (matches.length === 0) return null;

	let best = matches[0];
	if (matches.length > 1) {
		const taskWords = new Set(tokenize(step.description));
		let bestScore = -1;
		for (const candidate of matches) {
			const score = overlapScore(taskWords, candidate);
			if (score > bestScore) {
				bestScore = score;
				best = candidate;
			}
		}
	}

	return `[skill: ${best.manifest.name}] Bu görev için "${best.manifest.name}" skill'ini yükle ve talimatlarına uy — ${best.manifest.description}`;
}
