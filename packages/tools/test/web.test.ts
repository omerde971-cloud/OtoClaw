import { afterAll, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDuckDuckGoSearchProvider, createWebFetchTool, createWebSearchTool, hashUrl, sanitizeHeaders } from "../src/web";
import type { SearchProvider } from "../src/web";

const scratchDirs: string[] = [];
afterAll(() => {
	for (const dir of scratchDirs.splice(0)) {
		try {
			rmSync(dir, { recursive: true, force: true });
		} catch {
			// best-effort cleanup
		}
	}
});

function makeCacheDir(): string {
	const dir = mkdtempSync(join(tmpdir(), "otoclaw-webcache-"));
	scratchDirs.push(dir);
	return dir;
}

test("web.fetch never hits the network — uses the injected mock", async () => {
	let calls = 0;
	const mockFetch = (async () => {
		calls++;
		return new Response("mocked body", { status: 200 });
	}) as typeof fetch;

	const tool = createWebFetchTool(mockFetch, makeCacheDir());
	const result = await tool.run({ url: "https://example.com/data" }, { cwd: ".", sessionId: "s1" });

	expect(result.ok).toBe(true);
	expect(result.value?.body).toBe("mocked body");
	expect(result.value?.fromCache).toBe(false);
	expect(calls).toBe(1);
});

test("web.fetch caches the response and skips a second network call", async () => {
	let calls = 0;
	const mockFetch = (async () => {
		calls++;
		return new Response("cached body", { status: 200 });
	}) as typeof fetch;

	const cacheDir = makeCacheDir();
	const tool = createWebFetchTool(mockFetch, cacheDir);

	const first = await tool.run({ url: "https://example.com/cache-me" }, { cwd: ".", sessionId: "s1" });
	expect(first.value?.fromCache).toBe(false);

	const second = await tool.run({ url: "https://example.com/cache-me" }, { cwd: ".", sessionId: "s1" });
	expect(second.value?.fromCache).toBe(true);
	expect(second.value?.body).toBe("cached body");
	expect(calls).toBe(1);
});

test("web.fetch rejects unsupported protocols without calling fetch", async () => {
	let calls = 0;
	const mockFetch = (async () => {
		calls++;
		return new Response("", { status: 200 });
	}) as typeof fetch;

	const tool = createWebFetchTool(mockFetch, makeCacheDir());
	const result = await tool.run({ url: "file:///etc/passwd" }, { cwd: ".", sessionId: "s1" });

	expect(result.ok).toBe(false);
	expect(calls).toBe(0);
});

test("sanitizeHeaders strips sensitive headers", () => {
	const clean = sanitizeHeaders({ Authorization: "Bearer secret", "X-Custom": "keep-me", Cookie: "leak" });
	expect(clean.Authorization).toBeUndefined();
	expect(clean.Cookie).toBeUndefined();
	expect(clean["X-Custom"]).toBe("keep-me");
});

test("hashUrl is deterministic per URL", () => {
	expect(hashUrl("https://a.com")).toBe(hashUrl("https://a.com"));
	expect(hashUrl("https://a.com")).not.toBe(hashUrl("https://b.com"));
});

test("web.search returns results from the injected mock provider — no real network", async () => {
	const provider: SearchProvider = {
		search: async (query) => [{ title: `T:${query}`, url: "https://example.com", snippet: "s" }],
	};
	const tool = createWebSearchTool(provider);
	const result = await tool.run({ query: "otoclaw" }, { cwd: ".", sessionId: "s1" });

	expect(result.ok).toBe(true);
	expect(result.value?.[0]?.title).toBe("T:otoclaw");
	expect(result.value?.[0]?.url).toBe("https://example.com");
});

test("web.search rejects an empty query without ever calling the provider", async () => {
	let calls = 0;
	const provider: SearchProvider = {
		search: async () => {
			calls++;
			return [];
		},
	};
	const tool = createWebSearchTool(provider);
	const result = await tool.run({ query: "   " }, { cwd: ".", sessionId: "s1" });

	expect(result.ok).toBe(false);
	expect(calls).toBe(0);
});

test("web.search never crashes when the provider throws", async () => {
	const provider: SearchProvider = {
		search: async () => {
			throw new Error("provider boom");
		},
	};
	const tool = createWebSearchTool(provider);
	const result = await tool.run({ query: "x" }, { cwd: ".", sessionId: "s1" });

	expect(result.ok).toBe(false);
	expect(result.error).toContain("provider boom");
});

test("createDuckDuckGoSearchProvider parses result blocks from a mocked HTML response — no real network", async () => {
	const html =
		'<a rel="nofollow" class="result__a" href="https://duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fpage&amp;rut=abc">Example Title</a>' +
		'<span>...</span><a class="result__snippet" href="#">Example snippet text</a>';
	const mockFetch = (async () => new Response(html, { status: 200 })) as typeof fetch;
	const provider = createDuckDuckGoSearchProvider(mockFetch);

	const results = await provider.search("example");

	expect(results.length).toBe(1);
	expect(results[0]?.title).toBe("Example Title");
	expect(results[0]?.url).toBe("https://example.com/page");
	expect(results[0]?.snippet).toBe("Example snippet text");
});

test("createDuckDuckGoSearchProvider returns an empty list (never throws) on network failure", async () => {
	const mockFetch = (async () => {
		throw new Error("network down");
	}) as typeof fetch;
	const provider = createDuckDuckGoSearchProvider(mockFetch);

	const results = await provider.search("example");

	expect(results).toEqual([]);
});

test("createDuckDuckGoSearchProvider returns an empty list (never throws) on a non-ok response", async () => {
	const mockFetch = (async () => new Response("", { status: 503 })) as typeof fetch;
	const provider = createDuckDuckGoSearchProvider(mockFetch);

	const results = await provider.search("example");

	expect(results).toEqual([]);
});
