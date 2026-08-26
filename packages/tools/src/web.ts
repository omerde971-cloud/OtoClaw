import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Tool, ToolResult } from "./types";

/** Headers stripped from both the outgoing request and the cached record. */
const SENSITIVE_HEADER_PREFIXES = ["authorization", "cookie", "x-api-key", "x-auth", "proxy-authorization"];

export function sanitizeHeaders(headers: Record<string, string> | undefined): Record<string, string> {
	if (!headers) return {};
	const clean: Record<string, string> = {};
	for (const [key, value] of Object.entries(headers)) {
		const lower = key.toLowerCase();
		if (SENSITIVE_HEADER_PREFIXES.some((prefix) => lower.startsWith(prefix))) continue;
		clean[key] = value;
	}
	return clean;
}

export function cacheDir(): string {
	return join(homedir(), ".otoclaw", "cache");
}

export function hashUrl(url: string): string {
	return createHash("sha256").update(url).digest("hex");
}

interface WebFetchArgs {
	url: string;
	headers?: Record<string, string>;
}

interface WebFetchValue {
	status: number;
	body: string;
	fromCache: boolean;
}

interface CachedRecord {
	status: number;
	body: string;
}

export function createWebFetchTool(
	fetchImpl: typeof fetch = fetch,
	cacheDirOverride?: string,
): Tool<WebFetchArgs, WebFetchValue> {
	return {
		name: "web.fetch",
		description: "Fetch a URL, caching the response under ~/.otoclaw/cache.",
		permissionKey: "web.fetch",
		schema: {
			type: "object",
			properties: {
				url: { type: "string" },
				headers: { type: "object" },
			},
			required: ["url"],
		},
		async run(args): Promise<ToolResult<WebFetchValue>> {
			let parsed: URL;
			try {
				parsed = new URL(args.url);
			} catch {
				return { ok: false, error: `invalid url: ${args.url}` };
			}
			if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
				return { ok: false, error: `unsupported protocol: ${parsed.protocol}` };
			}

			const dir = cacheDirOverride ?? cacheDir();
			const cacheFile = join(dir, `${hashUrl(args.url)}.json`);
			try {
				const cached = await readFile(cacheFile, "utf8");
				const record = JSON.parse(cached) as CachedRecord;
				return { ok: true, value: { status: record.status, body: record.body, fromCache: true } };
			} catch {
				// no cache entry yet
			}

			try {
				const headers = sanitizeHeaders(args.headers);
				const response = await fetchImpl(args.url, { headers });
				const body = await response.text();
				const record: CachedRecord = { status: response.status, body };
				await mkdir(dir, { recursive: true });
				await writeFile(cacheFile, JSON.stringify(record), "utf8");
				return { ok: response.ok, value: { status: response.status, body, fromCache: false } };
			} catch (err) {
				return { ok: false, error: err instanceof Error ? err.message : String(err) };
			}
		},
	};
}

export const webFetch = createWebFetchTool();
