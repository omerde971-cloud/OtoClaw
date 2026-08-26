import { afterAll, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createWebFetchTool, hashUrl, sanitizeHeaders } from "../src/web";

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
