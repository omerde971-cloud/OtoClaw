import { cursorOverlay } from "./cursor-overlay";
import { dispatchClick, dispatchInput } from "./synthetic-events";

const POLL_INTERVAL_MS = 100;
const DEFAULT_TIMEOUT_MS = 5000;
// Small pause after moveTo() so the orange cursor's CSS transition is visible before the
// click fires, rather than teleporting and clicking in the same frame.
const CURSOR_SETTLE_MS = 120;

function isVisible(el: Element): boolean {
	const rect = el.getBoundingClientRect();
	if (rect.width === 0 && rect.height === 0) return false;
	const style = getComputedStyle(el);
	return style.visibility !== "hidden" && style.display !== "none";
}

function findByText(needle: string): Element | null {
	const candidates = document.querySelectorAll<HTMLElement>("button, a, [role='button'], input, textarea, label, summary");
	for (const el of candidates) {
		const value = "value" in el ? String((el as HTMLInputElement).value ?? "") : "";
		const text = (el.textContent ?? value).trim().toLowerCase();
		if (text?.includes(needle) && isVisible(el)) return el;
	}
	return null;
}

/** Finds an element by CSS selector, falling back to a case-insensitive visible-text match. */
export function findElement(selectorOrText: string): Element | null {
	try {
		const bySelector = document.querySelector(selectorOrText);
		if (bySelector) return bySelector;
	} catch {
		// Not a valid CSS selector — fall through to the text-based search below.
	}
	const needle = selectorOrText.trim().toLowerCase();
	return needle ? findByText(needle) : null;
}

export function waitForSelector(selector: string, timeoutMs: number = DEFAULT_TIMEOUT_MS): Promise<Element | null> {
	const existing = findElement(selector);
	if (existing) return Promise.resolve(existing);

	return new Promise((resolve) => {
		const start = Date.now();
		const timer = setInterval(() => {
			const el = findElement(selector);
			if (el || Date.now() - start >= timeoutMs) {
				clearInterval(timer);
				resolve(el);
			}
		}, POLL_INTERVAL_MS);
	});
}

function centerOf(el: Element): { x: number; y: number } {
	const rect = el.getBoundingClientRect();
	return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function wait(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Moves the virtual cursor to `selector`, clicks it, then dispatches a real click event. */
export async function clickElement(selector: string): Promise<boolean> {
	const el = findElement(selector);
	if (!el) return false;

	const { x, y } = centerOf(el);
	cursorOverlay.moveTo(x, y);
	await wait(CURSOR_SETTLE_MS);
	cursorOverlay.click();
	dispatchClick(el);
	return true;
}

/** Moves the virtual cursor to `selector` and types `text` into it via real keyboard events. */
export async function typeInto(selector: string, text: string): Promise<boolean> {
	const el = findElement(selector);
	if (!el || !(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return false;

	const { x, y } = centerOf(el);
	cursorOverlay.moveTo(x, y);
	await wait(CURSOR_SETTLE_MS);
	dispatchInput(el, text);
	return true;
}
