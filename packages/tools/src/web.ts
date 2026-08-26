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

export interface SearchResult {
	title: string;
	url: string;
	snippet: string;
}

/** Pluggable so a keyed provider (Brave, SerpAPI, ...) can be swapped in later without touching the tool. */
export interface SearchProvider {
	search(query: string): Promise<SearchResult[]>;
}

const DUCKDUCKGO_RESULT_RE =
	/<a rel="nofollow" class="result__a" href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;

function stripHtml(fragment: string): string {
	return fragment
		.replace(/<[^>]+>/g, "")
		.replace(/&amp;/g, "&")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.trim();
}

/** DuckDuckGo's HTML results wrap the real URL in a redirect link (`/l/?uddg=<encoded>`). */
function resolveDuckDuckGoUrl(href: string): string {
	try {
		const url = new URL(href, "https://duckduckgo.com");
		const target = url.searchParams.get("uddg");
		return target ? decodeURIComponent(target) : href;
	} catch {
		return href;
	}
}

/**
 * No-API-key default: a best-effort scrape of DuckDuckGo's no-JS HTML results page. Deliberately
 * simple (one regex pass) — never crashes; any network or parse failure yields an empty list.
 */
export function createDuckDuckGoSearchProvider(fetchImpl: typeof fetch = fetch): SearchProvider {
	return {
		async search(query: string): Promise<SearchResult[]> {
			try {
				const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
				const response = await fetchImpl(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; OtoClaw/1.0)" } });
				if (!response.ok) return [];
				const html = await response.text();

				const results: SearchResult[] = [];
				DUCKDUCKGO_RESULT_RE.lastIndex = 0;
				let match: RegExpExecArray | null = DUCKDUCKGO_RESULT_RE.exec(html);
				while (match !== null) {
					const [, href, titleHtml, snippetHtml] = match;
					results.push({
						title: stripHtml(titleHtml),
						url: resolveDuckDuckGoUrl(href),
						snippet: stripHtml(snippetHtml),
					});
					match = DUCKDUCKGO_RESULT_RE.exec(html);
				}
				return results;
			} catch {
				return [];
			}
		},
	};
}

interface WebSearchArgs {
	query: string;
}

/** Factory so a different SearchProvider (Brave/SerpAPI/...) can be swapped in without touching call sites. */
export function createWebSearchTool(searchProvider: SearchProvider): Tool<WebSearchArgs, SearchResult[]> {
	return {
		name: "web.search",
		description: "Search the web; returns a list of {title, url, snippet} results.",
		permissionKey: "web.fetch",
		schema: {
			type: "object",
			properties: {
				query: { type: "string" },
			},
			required: ["query"],
		},
		async run(args): Promise<ToolResult<SearchResult[]>> {
			if (!args.query?.trim()) {
				return { ok: false, error: "query must not be empty" };
			}
			try {
				const results = await searchProvider.search(args.query);
				return { ok: true, value: results };
			} catch (err) {
				return { ok: false, error: err instanceof Error ? err.message : String(err) };
			}
		},
	};
}

export const webSearch = createWebSearchTool(createDuckDuckGoSearchProvider());
