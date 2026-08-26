import { describe, expect, test } from "bun:test";
import { buildAuthUrl, exchangeCodeForTokens, isExpired, refreshAccessToken } from "../src/oauth";
import type { GoogleOAuthConfig } from "../src/types";

const CONFIG: GoogleOAuthConfig = {
	clientId: "client-id",
	clientSecret: "client-secret",
	redirectUri: "https://localhost/callback",
	scopes: ["https://www.googleapis.com/auth/gmail.readonly", "https://www.googleapis.com/auth/calendar.events"],
};

function jsonResponse(body: unknown, ok = true, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
		...(ok ? {} : {}),
	});
}

describe("buildAuthUrl", () => {
	test("produces the correct authorization query parameters", () => {
		const url = new URL(buildAuthUrl(CONFIG, "state-123"));
		expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
		expect(url.searchParams.get("client_id")).toBe("client-id");
		expect(url.searchParams.get("redirect_uri")).toBe("https://localhost/callback");
		expect(url.searchParams.get("scope")).toBe(
			"https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/calendar.events",
		);
		expect(url.searchParams.get("state")).toBe("state-123");
		expect(url.searchParams.get("response_type")).toBe("code");
		expect(url.searchParams.get("access_type")).toBe("offline");
		expect(url.searchParams.get("prompt")).toBe("consent");
	});
});

describe("exchangeCodeForTokens", () => {
	test("posts to the token endpoint and maps the response to OAuthTokens", async () => {
		const calls: Array<{ url: string; init?: RequestInit }> = [];
		const fetchImpl = (async (url: string, init?: RequestInit) => {
			calls.push({ url: url.toString(), init });
			return jsonResponse({
				access_token: "access-1",
				refresh_token: "refresh-1",
				expires_in: 3600,
				scope: "https://www.googleapis.com/auth/gmail.readonly",
				token_type: "Bearer",
			});
		}) as typeof fetch;

		const before = Date.now();
		const tokens = await exchangeCodeForTokens(CONFIG, "auth-code", fetchImpl);
		const after = Date.now();

		expect(calls).toHaveLength(1);
		expect(calls[0]?.url).toBe("https://oauth2.googleapis.com/token");
		expect(calls[0]?.init?.method).toBe("POST");
		const body = new URLSearchParams(calls[0]?.init?.body as string);
		expect(body.get("client_id")).toBe("client-id");
		expect(body.get("client_secret")).toBe("client-secret");
		expect(body.get("code")).toBe("auth-code");
		expect(body.get("grant_type")).toBe("authorization_code");

		expect(tokens.accessToken).toBe("access-1");
		expect(tokens.refreshToken).toBe("refresh-1");
		expect(tokens.scope).toEqual(["https://www.googleapis.com/auth/gmail.readonly"]);
		expect(tokens.expiresAt).toBeGreaterThanOrEqual(before + 3600 * 1000);
		expect(tokens.expiresAt).toBeLessThanOrEqual(after + 3600 * 1000);
	});

	test("throws when the token endpoint responds with an error status", async () => {
		const fetchImpl = (async () => jsonResponse({ error: "invalid_grant" }, false, 400)) as typeof fetch;
		await expect(exchangeCodeForTokens(CONFIG, "bad-code", fetchImpl)).rejects.toThrow(/400/);
	});
});

describe("refreshAccessToken", () => {
	test("posts a refresh_token grant and reuses the existing refresh token when none is returned", async () => {
		const calls: Array<{ url: string; init?: RequestInit }> = [];
		const fetchImpl = (async (url: string, init?: RequestInit) => {
			calls.push({ url: url.toString(), init });
			return jsonResponse({
				access_token: "access-2",
				expires_in: 1800,
				token_type: "Bearer",
			});
		}) as typeof fetch;

		const tokens = await refreshAccessToken(CONFIG, "refresh-1", fetchImpl);

		expect(calls[0]?.url).toBe("https://oauth2.googleapis.com/token");
		const body = new URLSearchParams(calls[0]?.init?.body as string);
		expect(body.get("grant_type")).toBe("refresh_token");
		expect(body.get("refresh_token")).toBe("refresh-1");

		expect(tokens.accessToken).toBe("access-2");
		expect(tokens.refreshToken).toBe("refresh-1");
		expect(tokens.scope).toEqual(CONFIG.scopes);
	});
});

describe("isExpired", () => {
	test("is expired when past expiresAt", () => {
		expect(isExpired({ accessToken: "a", refreshToken: "r", expiresAt: Date.now() - 1000, scope: [] })).toBe(true);
	});

	test("is expired within the skew window before expiresAt", () => {
		const expiresAt = Date.now() + 30000;
		expect(isExpired({ accessToken: "a", refreshToken: "r", expiresAt, scope: [] }, 60000)).toBe(true);
	});

	test("is not expired when comfortably in the future", () => {
		const expiresAt = Date.now() + 120000;
		expect(isExpired({ accessToken: "a", refreshToken: "r", expiresAt, scope: [] }, 60000)).toBe(false);
	});

	test("is expired exactly at the skew boundary", () => {
		const expiresAt = Date.now() + 60000;
		expect(isExpired({ accessToken: "a", refreshToken: "r", expiresAt, scope: [] }, 60000)).toBe(true);
	});
});
