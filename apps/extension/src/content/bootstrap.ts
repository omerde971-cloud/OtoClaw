import type { BackgroundToContentMessage, ContentAction, ContentToBackgroundMessage } from "../shared/messages";
import { cursorOverlay } from "./cursor-overlay";
import { clickElement, typeInto, waitForSelector } from "./dom-automation";

cursorOverlay.mount();

async function runAction(action: ContentAction): Promise<ContentToBackgroundMessage> {
	switch (action.type) {
		case "click": {
			const ok = await clickElement(action.selector);
			return { type: "actResult", ok, error: ok ? undefined : `element not found: ${action.selector}` };
		}
		case "type": {
			const ok = await typeInto(action.selector, action.text);
			return { type: "actResult", ok, error: ok ? undefined : `element not found: ${action.selector}` };
		}
		case "waitFor": {
			const el = await waitForSelector(action.selector, action.timeoutMs);
			return { type: "actResult", ok: el !== null, error: el ? undefined : `timed out waiting for: ${action.selector}` };
		}
	}
}

chrome.runtime.onMessage.addListener(
	(message: BackgroundToContentMessage, _sender, sendResponse: (response: ContentToBackgroundMessage) => void) => {
		if (message.type === "ping") {
			sendResponse({ type: "pong" });
			return true;
		}
		if (message.type === "act") {
			runAction(message.action).then(sendResponse);
			return true;
		}
		// navigate/screenshot are handled by the background service worker (tabs API), not here.
		return false;
	},
);
