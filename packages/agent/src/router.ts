import type { PlanStep } from "./types";

export interface ToolRoute {
	kind: "tool";
}

export type Route = ToolRoute;

/**
 * Phase 1 does not implement sub-agent orchestration (ARCHITECTURE.md §9 is Phase 2 scope).
 * A step that explicitly asks for the "subagent" route is a deliberate, tested boundary —
 * not a silently-ignored request.
 */
export class UnsupportedRouteError extends Error {
	constructor(public readonly requestedRoute: string) {
		super(`route "${requestedRoute}" is not supported in Phase 1 (sub-agent orchestration is Phase 2)`);
		this.name = "UnsupportedRouteError";
	}
}

export function router(step: PlanStep): Route {
	if (step.requestedRoute === "subagent") {
		throw new UnsupportedRouteError("subagent");
	}
	return { kind: "tool" };
}
