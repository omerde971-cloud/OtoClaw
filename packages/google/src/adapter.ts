import { isExpired, refreshAccessToken } from "./oauth";
import type { GoogleOAuthConfig, TokenStore } from "./types";

const GMAIL_BASE = "https://gmail.googleapis.com/gmail/v1";
const CALENDAR_BASE = "https://www.googleapis.com/calendar/v3";

export interface ComposeDraftParams {
	to: string[];
	subject: string;
	body: string;
}

export interface CreateEventParams {
	title: string;
	start: string;
	end: string;
	attendees?: string[];
}

export interface EmailThread {
	threadId: string;
	subject: string;
	messages: Array<{ from: string; body: string; ts: string }>;
}

export interface GoogleAdapter {
	openInbox(): Promise<void>;
	readThread(threadId: string): Promise<EmailThread>;
	composeDraft(params: ComposeDraftParams): Promise<void>;
	createEvent(params: CreateEventParams): Promise<void>;
}

interface GmailHeader {
	name: string;
	value: string;
}

interface GmailMessagePart {
	mimeType?: string;
	body?: { data?: string };
	parts?: GmailMessagePart[];
}

interface GmailMessage {
	id: string;
	internalDate?: string;
	payload?: {
		headers?: GmailHeader[];
		body?: { data?: string };
		parts?: GmailMessagePart[];
	};
}

interface GmailThreadResponse {
	id: string;
	messages?: GmailMessage[];
}

function headerValue(headers: GmailHeader[] | undefined, name: string): string {
	return headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function base64UrlDecode(data: string): string {
	const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
	return Buffer.from(normalized, "base64").toString("utf8");
}

function base64UrlEncode(data: string): string {
	return Buffer.from(data, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function extractBody(payload: GmailMessage["payload"]): string {
	if (!payload) return "";
	if (payload.body?.data) return base64UrlDecode(payload.body.data);
	const textPart = payload.parts?.find((part) => part.mimeType === "text/plain" && part.body?.data);
	if (textPart?.body?.data) return base64UrlDecode(textPart.body.data);
	return "";
}

function buildRawMessage(params: ComposeDraftParams): string {
	const mime = [`To: ${params.to.join(", ")}`, `Subject: ${params.subject}`, "Content-Type: text/plain; charset=UTF-8", "", params.body].join(
		"\r\n",
	);
	return base64UrlEncode(mime);
}

export function createGoogleOAuthAdapter(
	config: GoogleOAuthConfig,
	tokenStore: TokenStore,
	tokenKey: string,
	fetchImpl: typeof fetch = fetch,
): GoogleAdapter {
	async function getAccessToken(): Promise<string> {
		const tokens = await tokenStore.get(tokenKey);
		if (!tokens) {
			throw new Error(`no stored Google OAuth tokens for key "${tokenKey}"`);
		}
		if (!isExpired(tokens)) {
			return tokens.accessToken;
		}
		const refreshed = await refreshAccessToken(config, tokens.refreshToken, fetchImpl);
		await tokenStore.set(tokenKey, refreshed);
		return refreshed.accessToken;
	}

	async function authedFetch(url: string, init?: RequestInit): Promise<Response> {
		const accessToken = await getAccessToken();
		return fetchImpl(url, {
			...init,
			headers: {
				...init?.headers,
				Authorization: `Bearer ${accessToken}`,
			},
		});
	}

	return {
		async openInbox() {
			const response = await authedFetch(`${GMAIL_BASE}/users/me/threads`);
			if (!response.ok) {
				throw new Error(`failed to open inbox: ${response.status}`);
			}
		},

		async readThread(threadId: string): Promise<EmailThread> {
			const response = await authedFetch(`${GMAIL_BASE}/users/me/threads/${threadId}`);
			if (!response.ok) {
				throw new Error(`failed to read thread ${threadId}: ${response.status}`);
			}
			const data = (await response.json()) as GmailThreadResponse;
			const messages = data.messages ?? [];
			const subject = messages.length > 0 ? headerValue(messages[0]?.payload?.headers, "Subject") : "";
			return {
				threadId: data.id,
				subject,
				messages: messages.map((message) => ({
					from: headerValue(message.payload?.headers, "From"),
					body: extractBody(message.payload),
					ts: message.internalDate ?? "",
				})),
			};
		},

		async composeDraft(params: ComposeDraftParams) {
			const response = await authedFetch(`${GMAIL_BASE}/users/me/drafts`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ message: { raw: buildRawMessage(params) } }),
			});
			if (!response.ok) {
				throw new Error(`failed to compose draft: ${response.status}`);
			}
		},

		async createEvent(params: CreateEventParams) {
			const response = await authedFetch(`${CALENDAR_BASE}/calendars/primary/events`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					summary: params.title,
					start: { dateTime: params.start },
					end: { dateTime: params.end },
					attendees: params.attendees?.map((email) => ({ email })),
				}),
			});
			if (!response.ok) {
				throw new Error(`failed to create event: ${response.status}`);
			}
		},
	};
}
