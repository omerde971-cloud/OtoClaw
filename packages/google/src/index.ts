export const PACKAGE_NAME = "@otoclaw/google" as const;

export type { GoogleOAuthConfig, OAuthTokens, TokenStore } from "./types";
export { DEFAULT_GOOGLE_SCOPES } from "./types";
export { buildAuthUrl, exchangeCodeForTokens, isExpired, refreshAccessToken } from "./oauth";
export { createGoogleOAuthAdapter } from "./adapter";
export type { ComposeDraftParams, CreateEventParams, EmailThread, GoogleAdapter } from "./adapter";
