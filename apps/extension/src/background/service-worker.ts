import type { BackgroundToContentMessage, ContentToBackgroundMessage } from "../shared/messages";
import { NativePort } from "./native-port";

/**
 * Phase 4a skeleton: wires the extension lifecycle to the native messaging host so the
 * daemon can reach a real browser. DOM automation itself (routing browser.* requests to a
 * specific tab's content script) is Phase 4b's job.
 */
const nativePort = new NativePort();

chrome.runtime.onInstalled.addListener(() => {
	nativePort.connect();
});

chrome.runtime.onStartup.addListener(() => {
	nativePort.connect();
});

nativePort.onDisconnect(() => {
	// Best-effort reconnect; the native host may not be running yet (installed later).
	setTimeout(() => nativePort.connect(), 1000);
});

chrome.runtime.onMessage.addListener((message: ContentToBackgroundMessage) => {
	// Phase 4b wires real content-script <-> native-host forwarding here.
	void message;
});

export function forwardToContentScript(tabId: number, message: BackgroundToContentMessage): void {
	void chrome.tabs.sendMessage(tabId, message);
}

export { nativePort };
