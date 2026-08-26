import type { Skill } from "./types";

/**
 * Indexes skills by description + triggers and matches them against free-text task
 * descriptions. Keyword/substring only — no semantic/embedding search (out of scope).
 */
export class SkillRegistry {
	private readonly skills = new Map<string, Skill>();

	register(skill: Skill): void {
		this.skills.set(skill.manifest.name, skill);
	}

	unregister(name: string): void {
		this.skills.delete(name);
	}

	get(name: string): Skill | undefined {
		return this.skills.get(name);
	}

	has(name: string): boolean {
		return this.skills.has(name);
	}

	list(): Skill[] {
		return Array.from(this.skills.values());
	}

	/** Returns every registered skill whose triggers appear (case-insensitive) in `taskText`. */
	match(taskText: string): Skill[] {
		const haystack = taskText.toLowerCase();
		return this.list().filter((skill) =>
			skill.manifest.triggers.some((trigger) => haystack.includes(trigger.toLowerCase())),
		);
	}
}
