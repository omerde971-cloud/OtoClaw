/**
 * Dispatches real DOM events (not React/Vue-synthetic ones) so any framework's own event
 * delegation picks them up. `{bubbles:true,cancelable:true,composed:true}` matters because
 * React (and other frameworks) attach a single delegated listener at the document/root — an
 * event that doesn't bubble past shadow boundaries or the target never reaches it.
 */

const EVENT_INIT = { bubbles: true, cancelable: true, composed: true } as const;

export function dispatchClick(element: Element): void {
	const rect = element.getBoundingClientRect();
	const clientX = rect.left + rect.width / 2;
	const clientY = rect.top + rect.height / 2;
	const mouseInit: MouseEventInit = { ...EVENT_INIT, clientX, clientY, view: window, button: 0 };

	element.dispatchEvent(new MouseEvent("mousedown", mouseInit));
	element.dispatchEvent(new MouseEvent("mouseup", mouseInit));
	element.dispatchEvent(new MouseEvent("click", mouseInit));
}

function setNativeValue(element: HTMLInputElement | HTMLTextAreaElement, value: string): void {
	const proto = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
	const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
	setter?.call(element, value);
}

/**
 * Types into a `contenteditable` element (e.g. Gmail's compose body, which has no `.value`
 * setter to write through) by mutating `textContent` directly and firing the same
 * keydown/input/keyup sequence `dispatchInput` fires for real `<input>`/`<textarea>` elements.
 */
export function dispatchContentEditableInput(element: HTMLElement, text: string): void {
	// `isContentEditable` reflects attribute + ancestor inheritance in real browsers, but some
	// DOM test environments never compute it — checking the raw attribute too keeps this
	// working under both.
	if (!element.isContentEditable && element.getAttribute("contenteditable") !== "true") {
		throw new Error("dispatchContentEditableInput target must be contenteditable");
	}
	element.focus();

	let current = "";
	for (const char of text) {
		const keyInit: KeyboardEventInit = { ...EVENT_INIT, key: char };
		element.dispatchEvent(new KeyboardEvent("keydown", keyInit));
		current += char;
		element.textContent = current;
		element.dispatchEvent(new InputEvent("input", { ...EVENT_INIT, data: char, inputType: "insertText" }));
		element.dispatchEvent(new KeyboardEvent("keyup", keyInit));
	}

	element.dispatchEvent(new Event("change", EVENT_INIT));
}

/**
 * Dispatches a keyboard-shortcut chord (e.g. Ctrl+Enter, Ctrl+Shift+D, or a bare `c`) at
 * `target`. Used for Gmail/Calendar actions whose official keyboard shortcuts are stable
 * across UI locales, unlike button `aria-label`s (verified against a live Turkish-locale
 * Gmail/Calendar account).
 */
export function dispatchKeyCombo(
	target: EventTarget,
	key: string,
	modifiers: { ctrl?: boolean; shift?: boolean } = {},
): void {
	const keyInit: KeyboardEventInit = {
		...EVENT_INIT,
		key,
		ctrlKey: modifiers.ctrl ?? false,
		shiftKey: modifiers.shift ?? false,
	};
	target.dispatchEvent(new KeyboardEvent("keydown", keyInit));
	target.dispatchEvent(new KeyboardEvent("keyup", keyInit));
}

export function dispatchInput(element: Element, text: string): void {
	if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) {
		throw new Error("dispatchInput target must be an <input> or <textarea>");
	}
	element.focus();

	let current = "";
	for (const char of text) {
		const keyInit: KeyboardEventInit = { ...EVENT_INIT, key: char };
		element.dispatchEvent(new KeyboardEvent("keydown", keyInit));
		current += char;
		// React tracks <input>.value via a wrapped setter; writing through the native
		// prototype setter (bypassing React's) means the InputEvent below is what actually
		// notifies it, matching real typing instead of a silent value mutation.
		setNativeValue(element, current);
		element.dispatchEvent(new InputEvent("input", { ...EVENT_INIT, data: char, inputType: "insertText" }));
		element.dispatchEvent(new KeyboardEvent("keyup", keyInit));
	}

	element.dispatchEvent(new Event("change", EVENT_INIT));
}
