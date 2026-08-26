import { expect, test } from "bun:test";
import { createGithubTool } from "../src/github";

const ctx = { cwd: ".", sessionId: "s1" };

test("listIssues returns issues from a mocked GitHub API — no real network", async () => {
	let calls = 0;
	let capturedUrl = "";
	let capturedHeaders: Record<string, string> = {};
	const mockFetch = (async (url: string | URL, init?: RequestInit) => {
		calls++;
		capturedUrl = String(url);
		capturedHeaders = (init?.headers as Record<string, string>) ?? {};
		return new Response(JSON.stringify([{ number: 1, title: "bug", state: "open", body: null, html_url: "https://github.com/a/b/issues/1" }]), {
			status: 200,
		});
	}) as typeof fetch;

	const tool = createGithubTool({ token: "tok-123", fetchImpl: mockFetch });
	const result = await tool.run({ action: "listIssues", owner: "a", repo: "b" }, ctx);

	expect(result.ok).toBe(true);
	expect(Array.isArray(result.value)).toBe(true);
	expect((result.value as unknown[])[0]).toMatchObject({ number: 1, title: "bug" });
	expect(calls).toBe(1);
	expect(capturedUrl).toBe("https://api.github.com/repos/a/b/issues");
	expect(capturedHeaders.Authorization).toBe("Bearer tok-123");
	expect(capturedHeaders.Accept).toBe("application/vnd.github+json");
});

test("createIssue posts a new issue and returns it from a mocked GitHub API", async () => {
	let capturedMethod = "";
	let capturedBody = "";
	const mockFetch = (async (_url: string | URL, init?: RequestInit) => {
		capturedMethod = init?.method ?? "";
		capturedBody = String(init?.body ?? "");
		return new Response(
			JSON.stringify({ number: 42, title: "new issue", state: "open", body: "desc", html_url: "https://github.com/a/b/issues/42" }),
			{ status: 201 },
		);
	}) as typeof fetch;

	const tool = createGithubTool({ token: "tok-123", fetchImpl: mockFetch });
	const result = await tool.run({ action: "createIssue", owner: "a", repo: "b", title: "new issue", body: "desc" }, ctx);

	expect(result.ok).toBe(true);
	expect(result.value).toMatchObject({ number: 42, title: "new issue" });
	expect(capturedMethod).toBe("POST");
	expect(JSON.parse(capturedBody)).toEqual({ title: "new issue", body: "desc" });
});

test("createIssue without a title fails without calling fetch", async () => {
	let calls = 0;
	const mockFetch = (async () => {
		calls++;
		return new Response("{}", { status: 200 });
	}) as typeof fetch;

	const tool = createGithubTool({ token: "tok-123", fetchImpl: mockFetch });
	const result = await tool.run({ action: "createIssue", owner: "a", repo: "b" }, ctx);

	expect(result.ok).toBe(false);
	expect(calls).toBe(0);
});

test("getPullRequest returns a PR from a mocked GitHub API", async () => {
	const mockFetch = (async (url: string | URL) => {
		expect(String(url)).toBe("https://api.github.com/repos/a/b/pulls/7");
		return new Response(
			JSON.stringify({ number: 7, title: "feature", state: "open", body: null, html_url: "https://github.com/a/b/pull/7", merged: false }),
			{ status: 200 },
		);
	}) as typeof fetch;

	const tool = createGithubTool({ token: "tok-123", fetchImpl: mockFetch });
	const result = await tool.run({ action: "getPullRequest", owner: "a", repo: "b", pullNumber: 7 }, ctx);

	expect(result.ok).toBe(true);
	expect(result.value).toMatchObject({ number: 7, title: "feature" });
});

test("listPullRequests returns PRs from a mocked GitHub API", async () => {
	const mockFetch = (async () =>
		new Response(JSON.stringify([{ number: 3, title: "pr", state: "open", body: null, html_url: "x", merged: false }]), { status: 200 })) as typeof fetch;

	const tool = createGithubTool({ token: "tok-123", fetchImpl: mockFetch });
	const result = await tool.run({ action: "listPullRequests", owner: "a", repo: "b" }, ctx);

	expect(result.ok).toBe(true);
	expect(Array.isArray(result.value)).toBe(true);
});

test("missing token fails without ever calling fetch", async () => {
	let calls = 0;
	const mockFetch = (async () => {
		calls++;
		return new Response("{}", { status: 200 });
	}) as typeof fetch;

	const tool = createGithubTool({ fetchImpl: mockFetch });
	const result = await tool.run({ action: "listIssues", owner: "a", repo: "b" }, ctx);

	expect(result.ok).toBe(false);
	expect(result.error).toBe("no GitHub token configured");
	expect(calls).toBe(0);
});

test("404 from GitHub is converted to a structured error, not a crash", async () => {
	const mockFetch = (async () =>
		new Response(JSON.stringify({ message: "Not Found" }), { status: 404, statusText: "Not Found" })) as typeof fetch;

	const tool = createGithubTool({ token: "tok-123", fetchImpl: mockFetch });
	const result = await tool.run({ action: "listIssues", owner: "a", repo: "missing" }, ctx);

	expect(result.ok).toBe(false);
	expect(result.error).toBe("404: Not Found");
});

test("403 from GitHub (rate limit / forbidden) is converted to a structured error", async () => {
	const mockFetch = (async () =>
		new Response(JSON.stringify({ message: "API rate limit exceeded" }), { status: 403, statusText: "Forbidden" })) as typeof fetch;

	const tool = createGithubTool({ token: "tok-123", fetchImpl: mockFetch });
	const result = await tool.run({ action: "listIssues", owner: "a", repo: "b" }, ctx);

	expect(result.ok).toBe(false);
	expect(result.error).toBe("403: API rate limit exceeded");
});

test("422 from GitHub is converted to a structured error", async () => {
	const mockFetch = (async () =>
		new Response(JSON.stringify({ message: "Validation Failed" }), { status: 422, statusText: "Unprocessable Entity" })) as typeof fetch;

	const tool = createGithubTool({ token: "tok-123", fetchImpl: mockFetch });
	const result = await tool.run({ action: "createIssue", owner: "a", repo: "b", title: "x" }, ctx);

	expect(result.ok).toBe(false);
	expect(result.error).toBe("422: Validation Failed");
});

test("5xx from GitHub is converted to a structured error, not a crash", async () => {
	const mockFetch = (async () => new Response("oops", { status: 502, statusText: "Bad Gateway" })) as typeof fetch;

	const tool = createGithubTool({ token: "tok-123", fetchImpl: mockFetch });
	const result = await tool.run({ action: "listIssues", owner: "a", repo: "b" }, ctx);

	expect(result.ok).toBe(false);
	expect(result.error).toBe("502: Bad Gateway");
});

test("a thrown network error is converted to a structured error, not a crash", async () => {
	const mockFetch = (async () => {
		throw new Error("network down");
	}) as typeof fetch;

	const tool = createGithubTool({ token: "tok-123", fetchImpl: mockFetch });
	const result = await tool.run({ action: "listIssues", owner: "a", repo: "b" }, ctx);

	expect(result.ok).toBe(false);
	expect(result.error).toBe("network down");
});
