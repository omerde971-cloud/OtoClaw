/**
 * Message types passed between the background service worker, the content script, and the
 * native messaging host. Kept local to the extension (not @otoclaw/shared) since these never
 * cross the daemon's JSON-RPC wire directly — the native host translates between this shape
 * and the daemon's browser.* / vision.* protocol (packages/shared/src/protocol.ts).
 */

export type BackgroundToContentMessage =
	| { type: "ping" }
	| { type: "navigate"; url: string }
	| { type: "act"; action: ContentAction }
	| { type: "screenshot" };

export type ContentAction =
	| { type: "click"; selector: string }
	| { type: "type"; selector: string; text: string }
	| { type: "waitFor"; selector: string; timeoutMs?: number }
	| { type: "gmailReadInbox" }
	| { type: "gmailComposeDraft"; to: string; subject: string; body: string }
	| { type: "gmailSendDraft" }
	| { type: "calendarCreateEvent"; title: string }
	| { type: "calendarSaveEvent" };

export type ContentToBackgroundMessage =
	| { type: "pong" }
	| { type: "navigated"; url: string }
	| { type: "actResult"; ok: boolean; error?: string; data?: unknown }
	| { type: "screenshotResult"; dataUrl: string }
	| { type: "cursor"; x: number; y: number; action: "move" | "click" };

export type NativeHostMessage =
	| { jsonrpc: "2.0"; id: number | string; method: string; params: unknown }
	| { jsonrpc: "2.0"; id: number | string; result?: unknown; error?: { code: number; message: string } };
