import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Parses OtoClaw's `.env` format: one `NAME: value` pair per line, colon-separated
 * (not `=`, since some values, e.g. Ollama's base URL, contain a colon of their own —
 * only the first colon on the line is the separator). `#`-prefixed and blank lines
 * are comments/spacing and skipped; a line with no value yet (not yet filled in by
 * the user) is skipped rather than producing an empty-string entry.
 */
export function parseColonEnv(content: string): Record<string, string> {
	const result: Record<string, string> = {};
	for (const rawLine of content.split(/\r?\n/)) {
		const line = rawLine.trim();
		if (!line || line.startsWith("#")) continue;
		const colonIndex = line.indexOf(":");
		if (colonIndex === -1) continue;
		const key = line.slice(0, colonIndex).trim();
		const value = line.slice(colonIndex + 1).trim();
		if (!key || !value) continue;
		result[key] = value;
	}
	return result;
}

/**
 * Loads and parses the project's `.env` file. Defaults to `.env` in the current
 * working directory (consistent with how the daemon locates other project-relative
 * files, e.g. `skills/`). Never throws: a missing or unreadable file yields `{}`.
 */
export function loadEnvFile(path?: string): Record<string, string> {
	const filePath = path ?? join(process.cwd(), ".env");
	if (!existsSync(filePath)) return {};
	try {
		return parseColonEnv(readFileSync(filePath, "utf8"));
	} catch {
		return {};
	}
}
