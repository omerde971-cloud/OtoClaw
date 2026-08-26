/**
 * The agent's own on-screen mouse (ARCHITECTURE.md §14): a drawn overlay that visibly moves
 * and clicks so a human can watch the agent act. It never touches the real OS cursor — it is
 * a `position:fixed`, `pointer-events:none` div driven by CSS transforms.
 */

const OVERLAY_ID = "otoclaw-cursor-overlay";
const CLICKING_CLASS = "otoclaw-cursor-clicking";
const ORANGE = "#FF8800";
const SIZE_PX = 32;
const CLICK_ANIMATION_MS = 150;

export class CursorOverlay {
	private el: HTMLDivElement | null = null;
	private x = 0;
	private y = 0;

	mount(): void {
		if (this.el) return;
		const el = document.createElement("div");
		el.id = OVERLAY_ID;
		el.style.position = "fixed";
		el.style.top = "0";
		el.style.left = "0";
		el.style.width = `${SIZE_PX}px`;
		el.style.height = `${SIZE_PX}px`;
		el.style.zIndex = "2147483647";
		el.style.pointerEvents = "none";
		el.style.transition = "transform 120ms ease-out";
		el.style.willChange = "transform";
		el.style.transform = this.transformFor(this.x, this.y, 1);
		el.innerHTML = `<svg width="${SIZE_PX}" height="${SIZE_PX}" viewBox="0 0 24 24"><path d="M3 2 L21 12 L13 13 L10 21 Z" fill="${ORANGE}" stroke="#663300" stroke-width="1"/></svg>`;
		document.documentElement.appendChild(el);
		this.el = el;
	}

	unmount(): void {
		this.el?.remove();
		this.el = null;
	}

	moveTo(x: number, y: number): void {
		this.x = x;
		this.y = y;
		if (!this.el) return;
		this.el.style.transform = this.transformFor(x, y, 1);
	}

	click(): void {
		if (!this.el) return;
		const el = this.el;
		el.classList.add(CLICKING_CLASS);
		el.style.transform = this.transformFor(this.x, this.y, 0.75);
		setTimeout(() => {
			el.classList.remove(CLICKING_CLASS);
			el.style.transform = this.transformFor(this.x, this.y, 1);
		}, CLICK_ANIMATION_MS);
	}

	private transformFor(x: number, y: number, scale: number): string {
		return `translate(${x}px, ${y}px) scale(${scale})`;
	}
}

/** Shared instance used by the content script's automation helpers and by bootstrap.ts. */
export const cursorOverlay = new CursorOverlay();
