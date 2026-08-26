export interface OAuthTokens {
	accessToken: string;
	refreshToken: string;
	expiresAt: number;
	scope: string[];
}

export interface GoogleOAuthConfig {
	clientId: string;
	clientSecret: string;
	redirectUri: string;
	scopes: string[];
}

export interface TokenStore {
	get(key: string): Promise<OAuthTokens | null>;
	set(key: string, tokens: OAuthTokens): Promise<void>;
}

export const DEFAULT_GOOGLE_SCOPES: string[] = [
	"https://www.googleapis.com/auth/gmail.readonly",
	"https://www.googleapis.com/auth/calendar.events",
];
