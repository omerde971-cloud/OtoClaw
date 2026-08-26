import type { GoogleOAuthConfig, OAuthTokens } from "./types";

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

export function buildAuthUrl(config: GoogleOAuthConfig, state: string): string {
	const url = new URL(AUTH_ENDPOINT);
	url.searchParams.set("client_id", config.clientId);
	url.searchParams.set("redirect_uri", config.redirectUri);
	url.searchParams.set("scope", config.scopes.join(" "));
	url.searchParams.set("state", state);
	url.searchParams.set("response_type", "code");
	url.searchParams.set("access_type", "offline");
	url.searchParams.set("prompt", "consent");
	return url.toString();
}

interface TokenEndpointResponse {
	access_token: string;
	refresh_token?: string;
	expires_in: number;
	scope?: string;
	token_type: string;
}

function toOAuthTokens(
	response: TokenEndpointResponse,
	fallbackRefreshToken: string | undefined,
	fallbackScopes: string[],
): OAuthTokens {
	const refreshToken = response.refresh_token ?? fallbackRefreshToken;
	if (!refreshToken) {
		throw new Error("token response did not include a refresh_token");
	}
	return {
		accessToken: response.access_token,
		refreshToken,
		expiresAt: Date.now() + response.expires_in * 1000,
		scope: response.scope ? response.scope.split(" ") : fallbackScopes,
	};
}

export async function exchangeCodeForTokens(
	config: GoogleOAuthConfig,
	code: string,
	fetchImpl: typeof fetch = fetch,
): Promise<OAuthTokens> {
	const body = new URLSearchParams({
		client_id: config.clientId,
		client_secret: config.clientSecret,
		redirect_uri: config.redirectUri,
		code,
		grant_type: "authorization_code",
	});

	const response = await fetchImpl(TOKEN_ENDPOINT, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: body.toString(),
	});

	if (!response.ok) {
		throw new Error(`token exchange failed: ${response.status}`);
	}

	const data = (await response.json()) as TokenEndpointResponse;
	return toOAuthTokens(data, undefined, config.scopes);
}

export async function refreshAccessToken(
	config: GoogleOAuthConfig,
	refreshToken: string,
	fetchImpl: typeof fetch = fetch,
): Promise<OAuthTokens> {
	const body = new URLSearchParams({
		client_id: config.clientId,
		client_secret: config.clientSecret,
		refresh_token: refreshToken,
		grant_type: "refresh_token",
	});

	const response = await fetchImpl(TOKEN_ENDPOINT, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: body.toString(),
	});

	if (!response.ok) {
		throw new Error(`token refresh failed: ${response.status}`);
	}

	const data = (await response.json()) as TokenEndpointResponse;
	return toOAuthTokens(data, refreshToken, config.scopes);
}

export function isExpired(tokens: OAuthTokens, skewMs = 60000): boolean {
	return Date.now() + skewMs >= tokens.expiresAt;
}
