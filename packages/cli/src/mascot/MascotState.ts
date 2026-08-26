/** Full 10-state vocabulary the daemon may send (ARCHITECTURE.md §13). */
export type MascotStateName =
	| "thinking"
	| "coding"
	| "analyzing"
	| "planning"
	| "building"
	| "terminal"
	| "tool"
	| "waiting"
	| "done"
	| "presenting";

/** What the CLI actually knows how to render as a distinct animation this phase. */
export type RenderedMascotState = "thinking" | "coding" | "idle";

const RENDERED_STATES = new Set<RenderedMascotState>(["thinking", "coding"]);

/**
 * Only "thinking" and "coding" get real animations in Phase 1. Every other state in the
 * 10-state vocabulary (analyzing/planning/building/terminal/tool/waiting/done/presenting)
 * must not crash the client — it just falls back to a neutral idle look.
 */
export function toRenderedState(state: string): RenderedMascotState {
	return RENDERED_STATES.has(state as RenderedMascotState) ? (state as RenderedMascotState) : "idle";
}
