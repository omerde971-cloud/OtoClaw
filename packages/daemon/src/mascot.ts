import type { PipelineStage } from "@otoclaw/shared";

/**
 * Full 10-state mascot vocabulary (ARCHITECTURE.md §13). The daemon always emits the
 * semantically correct state; only the CLI client chooses to fully render a subset.
 */
export type MascotState =
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

/** `execute` has no state of its own — tool.start events drive the mascot during it. */
export function stageMascotState(stage: PipelineStage): MascotState | null {
	switch (stage) {
		case "intake":
			return "thinking";
		case "plan":
			return "thinking";
		case "route":
			return "building";
		case "execute":
			return null;
		case "auto-replan":
			return "planning";
		case "review":
			return "analyzing";
		case "deliver":
			return "presenting";
		default:
			return null;
	}
}

export function toolMascotState(toolName: string): MascotState {
	if (toolName === "shell.run") return "terminal";
	if (toolName === "fs.write" || toolName === "fs.edit") return "coding";
	if (toolName === "fs.read" || toolName === "web.fetch") return "analyzing";
	return "tool";
}
