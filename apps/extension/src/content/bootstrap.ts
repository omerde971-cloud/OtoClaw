import type { BackgroundToContentMessage, ContentToBackgroundMessage } from "../shared/messages";

/**
 * Phase 4a skeleton content script entry point. Real DOM automation (click/type/waitFor,
 * the orange virtual cursor overlay) is Phase 4b — this just proves the message channel
 * from background is wired up.
 */
chrome.runtime.onMessage.addListener(
	(message: BackgroundToContentMessage, _sender, sendResponse: (response: ContentToBackgroundMessage) => void) => {
		if (message.type === "ping") {
			sendResponse({ type: "pong" });
			return true;
		}
		// Other message types (navigate/act/screenshot) are handled for real in Phase 4b.
		return false;
	},
);
