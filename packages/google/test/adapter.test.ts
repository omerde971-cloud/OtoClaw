import { describe, expect, test } from "bun:test";
import { createGoogleOAuthAdapter } from "../src/adapter";
import type { GoogleOAuthConfig, OAuthTokens, TokenStore } from "../src/types";

const CONFIG: GoogleOAuthConfig = {
	clientId: "client-id",
	clientSecret: "client-secret",
	redirectUri: "https://localhost/callback",
	scopes: ["https://www.googleapis.com/auth/gmail.readonly", "https://www.googleapis.com/auth/calendar.events"],
};

const TOKEN_KEY = "user@example.com";

class InMemoryTokenStore implements TokenStore {
	private tokens: Map<string, OAuthTokens> = new Map();

	constructor(initial?: Record<string, OAuthTokens>) {
		if (initial) {
			for (const [key, value] of Object.entries(initial)) this.tokens.set(key, value);
		}
	}

	async get(key: string): Promise<OAuthTokens | null> {
		return this.tokens.get(key) ?? null;
	}

	async set(key: string, tokens: OAuthTokens): Promise<void> {
		this.tokens.set(key, tokens);
	}
}

function validTokens(): OAuthTokens {
	return {
		accessToken: "valid-access-token",
		refreshToken: "refresh-token",
		expiresAt: Date.now() + 3600 * 1000,
		scope: CONFIG.scopes,
	};
}

function expiredTokens(): OAuthTokens {
	return {
		accessToken: "expired-access-token",
		refreshToken: "refresh-token",
		expiresAt: Date.now() - 1000,
		scope: CONFIG.scopes,
	};
}

function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("createGoogleOAuthAdapter", () => {
	test("composeDraft calls the Gmail drafts endpoint with a bearer token and base64url raw message", async () => {
		const store = new InMemoryTokenStore({ [TOKEN_KEY]: validTokens() });
		const calls: Array<{ url: string; init?: RequestInit }> = [];
		const fetchImpl = (async (url: string, init?: RequestInit) => {
			calls.push({ url: url.toString(), init });
			return jsonResponse({ id: "draft-1" });
		}) as typeof fetch;

		const adapter = createGoogleOAuthAdapter(CONFIG, store, TOKEN_KEY, fetchImpl);
		await adapter.composeDraft({ to: ["a@b.com"], subject: "Hi", body: "Hello there" });

		expect(calls).toHaveLength(1);
		expect(calls[0]?.url).toBe("https://gmail.googleapis.com/gmail/v1/users/me/drafts");
		expect(calls[0]?.init?.method).toBe("POST");
		const headers = calls[0]?.init?.headers as Record<string, string>;
		expect(headers.Authorization).toBe("Bearer valid-access-token");

		const payload = JSON.parse(calls[0]?.init?.body as string) as { message: { raw: string } };
		expect(payload.message.raw).not.toMatch(/[+/=]/);
		const decoded = Buffer.from(payload.message.raw.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
		expect(decoded).toContain("To: a@b.com");
		expect(decoded).toContain("Subject: Hi");
		expect(decoded).toContain("Hello there");
	});

	test("createEvent calls the Calendar events endpoint with the right body", async () => {
		const store = new InMemoryTokenStore({ [TOKEN_KEY]: validTokens() });
		const calls: Array<{ url: string; init?: RequestInit }> = [];
		const fetchImpl = (async (url: string, init?: RequestInit) => {
			calls.push({ url: url.toString(), init });
			return jsonResponse({ id: "event-1" });
		}) as typeof fetch;

		const adapter = createGoogleOAuthAdapter(CONFIG, store, TOKEN_KEY, fetchImpl);
		await adapter.createEvent({
			title: "Sync",
			start: "2026-08-27T10:00:00Z",
			end: "2026-08-27T10:30:00Z",
			attendees: ["a@b.com"],
		});

		expect(calls[0]?.url).toBe("https://www.googleapis.com/calendar/v3/calendars/primary/events");
		const headers = calls[0]?.init?.headers as Record<string, string>;
		expect(headers.Authorization).toBe("Bearer valid-access-token");
		const body = JSON.parse(calls[0]?.init?.body as string);
		expect(body).toEqual({
			summary: "Sync",
			start: { dateTime: "2026-08-27T10:00:00Z" },
			end: { dateTime: "2026-08-27T10:30:00Z" },
			attendees: [{ email: "a@b.com" }],
		});
	});

	test("automatically refreshes an expired access token and persists it before making the request", async () => {
		const store = new InMemoryTokenStore({ [TOKEN_KEY]: expiredTokens() });
		const calls: Array<{ url: string; init?: RequestInit }> = [];
		const fetchImpl = (async (url: string, init?: RequestInit) => {
			const urlStr = url.toString();
			calls.push({ url: urlStr, init });
			if (urlStr === "https://oauth2.googleapis.com/token") {
				return jsonResponse({
					access_token: "refreshed-access-token",
					expires_in: 3600,
					token_type: "Bearer",
				});
			}
			return jsonResponse({ id: "event-2" });
		}) as typeof fetch;

		const adapter = createGoogleOAuthAdapter(CONFIG, store, TOKEN_KEY, fetchImpl);
		await adapter.createEvent({ title: "Sync", start: "2026-08-27T10:00:00Z", end: "2026-08-27T10:30:00Z" });

		expect(calls).toHaveLength(2);
		expect(calls[0]?.url).toBe("https://oauth2.googleapis.com/token");
		expect(calls[1]?.url).toBe("https://www.googleapis.com/calendar/v3/calendars/primary/events");
		const headers = calls[1]?.init?.headers as Record<string, string>;
		expect(headers.Authorization).toBe("Bearer refreshed-access-token");

		const stored = await store.get(TOKEN_KEY);
		expect(stored?.accessToken).toBe("refreshed-access-token");
		expect(stored?.refreshToken).toBe("refresh-token");
	});

	test("readThread parses the Gmail thread response into subject/messages", async () => {
		const store = new InMemoryTokenStore({ [TOKEN_KEY]: validTokens() });
		const encodedBody = Buffer.from("Hello world", "utf8")
			.toString("base64")
			.replace(/\+/g, "-")
			.replace(/\//g, "_")
			.replace(/=+$/, "");
		const fetchImpl = (async () =>
			jsonResponse({
				id: "thread-1",
				messages: [
					{
						id: "msg-1",
						internalDate: "1700000000000",
						payload: {
							headers: [
								{ name: "Subject", value: "Test subject" },
								{ name: "From", value: "sender@example.com" },
							],
							body: { data: encodedBody },
						},
					},
				],
			})) as typeof fetch;

		const adapter = createGoogleOAuthAdapter(CONFIG, store, TOKEN_KEY, fetchImpl);
		const thread = await adapter.readThread("thread-1");

		expect(thread.threadId).toBe("thread-1");
		expect(thread.subject).toBe("Test subject");
		expect(thread.messages).toEqual([{ from: "sender@example.com", body: "Hello world", ts: "1700000000000" }]);
	});

	test("throws when no tokens are stored", async () => {
		const store = new InMemoryTokenStore();
		const fetchImpl = (async () => jsonResponse({})) as typeof fetch;
		const adapter = createGoogleOAuthAdapter(CONFIG, store, TOKEN_KEY, fetchImpl);
		await expect(adapter.openInbox()).rejects.toThrow(/no stored Google OAuth tokens/);
	});
});
