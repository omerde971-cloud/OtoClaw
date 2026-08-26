import type { Dirent } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { SkillManifestSchema, type Skill } from "./types";

const MANIFEST_FILE = "skill.json";
const INSTRUCTIONS_FILE = "SKILL.md";

/** Reads a single `<dir>/skill.json` + `<dir>/SKILL.md` pair into a Skill. */
export async function loadSkillFromDir(dir: string): Promise<Skill> {
	const manifestRaw = await readFile(join(dir, MANIFEST_FILE), "utf8");
	const manifest = SkillManifestSchema.parse(JSON.parse(manifestRaw));
	const instructions = await readFile(join(dir, INSTRUCTIONS_FILE), "utf8");
	return { manifest, instructions };
}

/** Loads every immediate subdirectory of `rootDir` that contains a valid skill folder. */
export async function loadSkillsFromDir(rootDir: string): Promise<Skill[]> {
	let entries: Dirent[];
	try {
		entries = await readdir(rootDir, { withFileTypes: true });
	} catch {
		return [];
	}

	const skills: Skill[] = [];
	for (const entry of entries) {
		if (!entry.isDirectory()) continue;
		try {
			skills.push(await loadSkillFromDir(join(rootDir, entry.name.toString())));
		} catch {
			// Not a valid skill folder (missing/invalid manifest or instructions) — skip it.
		}
	}
	return skills;
}
