import { expect, test } from "bun:test";
import { createYoutubeTool } from "../src/youtube";

test("youtube searchVideos returns results from the mocked API — no real network", async () => {
	let calls = 0;
	const mockFetch = (async (input: string | URL) => {
		calls++;
		const url = new URL(input as string);
		expect(url.pathname).toBe("/youtube/v3/search");
		expect(url.searchParams.get("q")).toBe("otoclaw");
		expect(url.searchParams.get("key")).toBe("test-key");
		return new Response(JSON.stringify({ items: [{ id: { videoId: "abc123" } }] }), { status: 200 });
	}) as typeof fetch;

	const tool = createYoutubeTool({ apiKey: "test-key", fetchImpl: mockFetch });
	const result = await tool.run({ action: "searchVideos", query: "otoclaw" }, { cwd: ".", sessionId: "s1" });

	expect(result.ok).toBe(true);
	expect(result.value?.items?.[0]?.id?.videoId).toBe("abc123");
	expect(calls).toBe(1);
});

test("youtube getVideoDetails returns results from the mocked API — no real network", async () => {
	const mockFetch = (async (input: string | URL) => {
		const url = new URL(input as string);
		expect(url.pathname).toBe("/youtube/v3/videos");
		expect(url.searchParams.get("id")).toBe("vid1");
		return new Response(JSON.stringify({ items: [{ id: "vid1", snippet: { title: "Test Video" } }] }), { status: 200 });
	}) as typeof fetch;

	const tool = createYoutubeTool({ apiKey: "test-key", fetchImpl: mockFetch });
	const result = await tool.run({ action: "getVideoDetails", videoId: "vid1" }, { cwd: ".", sessionId: "s1" });

	expect(result.ok).toBe(true);
	expect(result.value?.items?.[0]?.snippet?.title).toBe("Test Video");
});

test("youtube getChannelDetails returns results from the mocked API — no real network", async () => {
	const mockFetch = (async (input: string | URL) => {
		const url = new URL(input as string);
		expect(url.pathname).toBe("/youtube/v3/channels");
		expect(url.searchParams.get("id")).toBe("chan1");
		return new Response(JSON.stringify({ items: [{ id: "chan1", snippet: { title: "Test Channel" } }] }), { status: 200 });
	}) as typeof fetch;

	const tool = createYoutubeTool({ apiKey: "test-key", fetchImpl: mockFetch });
	const result = await tool.run({ action: "getChannelDetails", channelId: "chan1" }, { cwd: ".", sessionId: "s1" });

	expect(result.ok).toBe(true);
	expect(result.value?.items?.[0]?.snippet?.title).toBe("Test Channel");
});

test("youtube returns an error when no API key is configured — never calls fetch", async () => {
	let calls = 0;
	const mockFetch = (async () => {
		calls++;
		return new Response("", { status: 200 });
	}) as typeof fetch;

	const tool = createYoutubeTool({ fetchImpl: mockFetch });
	const result = await tool.run({ action: "searchVideos", query: "x" }, { cwd: ".", sessionId: "s1" });

	expect(result.ok).toBe(false);
	expect(result.error).toBe("no YouTube API key configured");
	expect(calls).toBe(0);
});

test("youtube converts an HTTP error response into a failed ToolResult instead of throwing", async () => {
	const mockFetch = (async () =>
		new Response(JSON.stringify({ error: { message: "API key not valid" } }), { status: 400 })) as typeof fetch;

	const tool = createYoutubeTool({ apiKey: "bad-key", fetchImpl: mockFetch });
	const result = await tool.run({ action: "searchVideos", query: "x" }, { cwd: ".", sessionId: "s1" });

	expect(result.ok).toBe(false);
	expect(result.error).toBe("API key not valid");
});

test("youtube rejects searchVideos without a query — never calls fetch", async () => {
	let calls = 0;
	const mockFetch = (async () => {
		calls++;
		return new Response("", { status: 200 });
	}) as typeof fetch;

	const tool = createYoutubeTool({ apiKey: "test-key", fetchImpl: mockFetch });
	const result = await tool.run({ action: "searchVideos" }, { cwd: ".", sessionId: "s1" });

	expect(result.ok).toBe(false);
	expect(calls).toBe(0);
});

test("youtube never crashes when fetch throws", async () => {
	const mockFetch = (async () => {
		throw new Error("network down");
	}) as typeof fetch;

	const tool = createYoutubeTool({ apiKey: "test-key", fetchImpl: mockFetch });
	const result = await tool.run({ action: "getVideoDetails", videoId: "v1" }, { cwd: ".", sessionId: "s1" });

	expect(result.ok).toBe(false);
	expect(result.error).toContain("network down");
});
