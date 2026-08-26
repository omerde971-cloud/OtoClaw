import type { BackgroundToContentMessage, ContentAction, ContentToBackgroundMessage } from "../shared/messages";
import { googleAdapter } from "../adapters/google";
import { cursorOverlay } from "./cursor-overlay";
import { clickElement, typeInto, waitForSelector } from "./dom-automation";

cursorOverlay.mount();

async function runGoogleAction(action: ContentAction): Promise<ContentToBackgroundMessage> {
	try {
		switch (action.type) {
			case "gmailReadInbox": {
				const data = await googleAdapter.openInbox();
				return { type: "actResult", ok: true, data };
			}
			case "gmailComposeDraft": {
				await googleAdapter.composeDraft({ to: [action.to], subject: action.subject, body: action.body });
				return { type: "actResult", ok: true };
			}
			case "gmailSendDraft": {
				await googleAdapter.sendDraft();
				return { type: "actResult", ok: true };
			}
			case "calendarCreateEvent": {
				await googleAdapter.createEvent({ title: action.title, start: "", end: "" });
				return { type: "actResult", ok: true };
			}
			case "calendarSaveEvent": {
				await googleAdapter.saveEvent();
				return { type: "actResult", ok: true };
			}
			default:
				return { type: "actResult", ok: false, error: `unhandled google action: ${(action as { type: string }).type}` };
		}
	} catch (err) {
		return { type: "actResult", ok: false, error: err instanceof Error ? err.message : String(err) };
	}
}

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
		case "gmailReadInbox":
		case "gmailComposeDraft":
		case "gmailSendDraft":
		case "calendarCreateEvent":
		case "calendarSaveEvent":
			return runGoogleAction(action);
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
