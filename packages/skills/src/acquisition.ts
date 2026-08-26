import { randomUUID } from "node:crypto";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { extname, join } from "node:path";
import type { QuestionChannel } from "@otoclaw/agent";
import type { SkillCandidate } from "./types";
import type { SkillRegistry } from "./registry";

export interface SkillSourceSearch {
	search(name: string): Promise<SkillCandidate[]>;
}

/** Real GitHub-backed source search. Never exercised in tests — those inject a mock. */
export class GithubSkillSourceSearch implements SkillSourceSearch {
	async search(name: string): Promise<SkillCandidate[]> {
		const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(name)}+topic:otoclaw-skill`;
		const res = await fetch(url, { headers: { Accept: "application/vnd.github+json" } });
		if (!res.ok) return [];
		const data = (await res.json()) as {
			items?: Array<{ full_name: string; html_url: string; description?: string }>;
		};
		return (data.items ?? []).map((item) => ({
			name,
			source: "github" as const,
			location: item.html_url,
			description: item.description,
		}));
	}
}

export interface AcquireSkillContext {
	registry: SkillRegistry;
	questionChannel: QuestionChannel;
	sourceSearch: SkillSourceSearch;
	install: (candidate: SkillCandidate) => Promise<void>;
}

export type AcquireSkillResult = "installed" | "skipped" | "not_found";

/**
 * find -> approve (question.ask, non-blocking Promise) -> install, per ARCHITECTURE.md §11.
 * Never installs without an explicit "install" answer.
 */
export async function acquireSkill(name: string, ctx: AcquireSkillContext): Promise<AcquireSkillResult> {
	if (ctx.registry.has(name)) return "installed";

	const candidates = await ctx.sourceSearch.search(name);
	const candidate = candidates[0];
	if (!candidate) return "not_found";

	const answer = await ctx.questionChannel.ask({
		questionId: randomUUID(),
		header: `Install skill: ${name}`,
		question: `Install skill "${name}" from ${candidate.source} (${candidate.location})?`,
		options: [
			{ id: "install", label: "Install" },
			{ id: "skip", label: "Skip" },
		],
	});

	if (answer.optionId !== "install") return "skipped";

	await ctx.install(candidate);
	return "installed";
}

/**
 * Fire-and-forget wrapper: starts `acquireSkill` and returns immediately without awaiting
 * it, so a caller can keep doing other ready work while the question.ask round trip (and
 * install) resolve in the background. Result arrives via `onResult`.
 */
export function acquireSkillInBackground(
	name: string,
	ctx: AcquireSkillContext,
	onResult: (result: AcquireSkillResult) => void,
): void {
	acquireSkill(name, ctx)
		.then(onResult)
		.catch(() => onResult("skipped"));
}

export interface QuarantineFile {
	filename: string;
	content: string;
}

/** skill.json/SKILL.md only — no scripts, no binaries, no executables. */
const ALLOWED_EXTENSIONS = new Set([".md", ".json", ".txt"]);

export function verifyQuarantineFiles(files: QuarantineFile[]): boolean {
	return files.length > 0 && files.every((file) => ALLOWED_EXTENSIONS.has(extname(file.filename).toLowerCase()));
}

export interface SandboxInstallOptions {
	/** Defaults to `.otoclaw/skills-quarantine` under the current working directory. */
	quarantineRoot?: string;
	/** Defaults to `~/.otoclaw/skills`. */
	skillsRoot?: string;
}

/**
 * Writes `files` into `.otoclaw/skills-quarantine/<id>/`, rejects anything outside the
 * .md/.json/.txt allowlist, then promotes the quarantined folder into `~/.otoclaw/skills/`.
 * This is the whole of "sandbox-install" for Phase 2c — no code execution is ever involved.
 */
export async function sandboxInstallSkill(
	candidate: SkillCandidate,
	files: QuarantineFile[],
	options: SandboxInstallOptions = {},
): Promise<string> {
	if (!verifyQuarantineFiles(files)) {
		throw new Error(`skill "${candidate.name}" rejected: quarantine contains a disallowed file type`);
	}

	const quarantineRoot = options.quarantineRoot ?? join(".otoclaw", "skills-quarantine");
	const skillsRoot = options.skillsRoot ?? join(homedir(), ".otoclaw", "skills");

	const quarantineDir = join(quarantineRoot, randomUUID());
	await mkdir(quarantineDir, { recursive: true });
	for (const file of files) {
		await writeFile(join(quarantineDir, file.filename), file.content, "utf8");
	}

	await mkdir(skillsRoot, { recursive: true });
	const finalDir = join(skillsRoot, candidate.name);
	await rename(quarantineDir, finalDir);
	return finalDir;
}
