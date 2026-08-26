import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import type { Tool, ToolContext, ToolResult } from "./types";

/** Resolves `path` against `ctx.cwd` and rejects anything that escapes the jail. */
export function resolveWithinCwd(ctx: ToolContext, path: string): ToolResult<string> {
	const resolved = isAbsolute(path) ? resolve(path) : resolve(ctx.cwd, path);
	const rel = relative(ctx.cwd, resolved);
	if (rel.startsWith("..") || isAbsolute(rel)) {
		return { ok: false, error: `path escapes session cwd jail: ${path}` };
	}
	return { ok: true, value: resolved };
}

function unifiedLikeDiff(path: string, before: string, after: string): string {
	const beforeLines = before.split("\n");
	const afterLines = after.split("\n");
	const lines: string[] = [`--- ${path}`, `+++ ${path}`];
	const max = Math.max(beforeLines.length, afterLines.length);
	for (let i = 0; i < max; i++) {
		const b = beforeLines[i];
		const a = afterLines[i];
		if (b === a) {
			if (b !== undefined) lines.push(` ${b}`);
			continue;
		}
		if (b !== undefined) lines.push(`-${b}`);
		if (a !== undefined) lines.push(`+${a}`);
	}
	return lines.join("\n");
}

interface FsReadArgs {
	path: string;
	range?: { start: number; end: number };
}

export const fsRead: Tool<FsReadArgs, { content: string }> = {
	name: "fs.read",
	description: "Read a file's contents, optionally within a line range.",
	permissionKey: "fs.read",
	schema: {
		type: "object",
		properties: {
			path: { type: "string" },
			range: {
				type: "object",
				properties: {
					start: { type: "number" },
					end: { type: "number" },
				},
				required: ["start", "end"],
			},
		},
		required: ["path"],
	},
	async run(args, ctx) {
		const resolved = resolveWithinCwd(ctx, args.path);
		if (!resolved.ok) return { ok: false, error: resolved.error };
		try {
			const raw = await readFile(resolved.value as string, "utf8");
			if (!args.range) return { ok: true, value: { content: raw } };
			const lines = raw.split("\n");
			const slice = lines.slice(Math.max(0, args.range.start - 1), args.range.end).join("\n");
			return { ok: true, value: { content: slice } };
		} catch (err) {
			return { ok: false, error: err instanceof Error ? err.message : String(err) };
		}
	},
};

interface FsWriteArgs {
	path: string;
	content: string;
}

export const fsWrite: Tool<FsWriteArgs, { diff: string; applied: boolean }> = {
	name: "fs.write",
	description: "Write a file's full contents, producing a diff before applying.",
	permissionKey: "fs.write",
	schema: {
		type: "object",
		properties: {
			path: { type: "string" },
			content: { type: "string" },
		},
		required: ["path", "content"],
	},
	async run(args, ctx) {
		const resolved = resolveWithinCwd(ctx, args.path);
		if (!resolved.ok) return { ok: false, error: resolved.error };
		const target = resolved.value as string;
		let before = "";
		try {
			before = await readFile(target, "utf8");
		} catch {
			before = "";
		}
		const diff = unifiedLikeDiff(args.path, before, args.content);
		try {
			await mkdir(dirname(target), { recursive: true });
			await writeFile(target, args.content, "utf8");
			return { ok: true, value: { diff, applied: true } };
		} catch (err) {
			return { ok: false, error: err instanceof Error ? err.message : String(err) };
		}
	},
};

interface FsEditArgs {
	path: string;
	find: string;
	replace: string;
}

export const fsEdit: Tool<FsEditArgs, { diff: string; applied: boolean }> = {
	name: "fs.edit",
	description: "Exact-match find/replace patch within a file, producing a diff before applying.",
	permissionKey: "fs.write",
	schema: {
		type: "object",
		properties: {
			path: { type: "string" },
			find: { type: "string" },
			replace: { type: "string" },
		},
		required: ["path", "find", "replace"],
	},
	async run(args, ctx) {
		const resolved = resolveWithinCwd(ctx, args.path);
		if (!resolved.ok) return { ok: false, error: resolved.error };
		const target = resolved.value as string;
		let before: string;
		try {
			before = await readFile(target, "utf8");
		} catch (err) {
			return { ok: false, error: err instanceof Error ? err.message : String(err) };
		}
		if (!before.includes(args.find)) {
			return { ok: false, error: "find string not found in file (exact match required)" };
		}
		const occurrences = before.split(args.find).length - 1;
		if (occurrences > 1) {
			return { ok: false, error: `find string is not unique in file (${occurrences} matches)` };
		}
		const after = before.replace(args.find, args.replace);
		const diff = unifiedLikeDiff(args.path, before, after);
		try {
			await writeFile(target, after, "utf8");
			return { ok: true, value: { diff, applied: true } };
		} catch (err) {
			return { ok: false, error: err instanceof Error ? err.message : String(err) };
		}
	},
};
