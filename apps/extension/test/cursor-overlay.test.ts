import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register();

const { afterAll, afterEach, expect, test } = await import("bun:test");
const { CursorOverlay } = await import("../src/content/cursor-overlay");

let overlay: InstanceType<typeof CursorOverlay>;

afterEach(() => {
	overlay?.unmount();
});

// Undo the global DOM registration so it doesn't leak into other test files sharing this
// bun test process (e.g. it otherwise replaces the native Response class Bun.serve expects).
afterAll(async () => {
	await GlobalRegistrator.unregister();
});

test("mount() adds the overlay to the DOM", () => {
	overlay = new CursorOverlay();
	overlay.mount();
	expect(document.getElementById("otoclaw-cursor-overlay")).not.toBeNull();
});

test("mount() is idempotent (calling it twice keeps a single overlay element)", () => {
	overlay = new CursorOverlay();
	overlay.mount();
	overlay.mount();
	expect(document.querySelectorAll("#otoclaw-cursor-overlay").length).toBe(1);
});

test("unmount() removes the overlay from the DOM", () => {
	overlay = new CursorOverlay();
	overlay.mount();
	overlay.unmount();
	expect(document.getElementById("otoclaw-cursor-overlay")).toBeNull();
});

test("the overlay is orange and larger than a typical 24px OS cursor", () => {
	overlay = new CursorOverlay();
	overlay.mount();
	const el = document.getElementById("otoclaw-cursor-overlay") as HTMLElement;
	expect(el.style.width).toBe("32px");
	expect(el.style.height).toBe("32px");
	expect(el.style.pointerEvents).toBe("none");
	expect(el.innerHTML).toContain("#FF8800");
});

test("moveTo() writes a CSS transform carrying the given coordinates", () => {
	overlay = new CursorOverlay();
	overlay.mount();
	overlay.moveTo(120, 80);
	const el = document.getElementById("otoclaw-cursor-overlay") as HTMLElement;
	expect(el.style.transform).toContain("translate(120px, 80px)");
});

test("moveTo() before mount() does not throw, and is applied once mounted", () => {
	overlay = new CursorOverlay();
	overlay.moveTo(50, 60);
	overlay.mount();
	const el = document.getElementById("otoclaw-cursor-overlay") as HTMLElement;
	expect(el.style.transform).toContain("translate(50px, 60px)");
});

test("click() marks the overlay with a clicking class to trigger its click effect", () => {
	overlay = new CursorOverlay();
	overlay.mount();
	overlay.click();
	const el = document.getElementById("otoclaw-cursor-overlay") as HTMLElement;
	expect(el.classList.contains("otoclaw-cursor-clicking")).toBe(true);
});
