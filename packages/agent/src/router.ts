import type { PlanStep, SubAgentBrief } from "./types";

export interface ToolRoute {
	kind: "tool";
}

export interface SubAgentRoute {
	kind: "subagent";
	role: SubAgentBrief["role"];
}

export type Route = ToolRoute | SubAgentRoute;

/**
 * planner.ts only ever emits requestedRoute "tool" | "subagent" | undefined — this guards
 * against any other value slipping through at runtime (e.g. a malformed planner response).
 */
export class UnsupportedRouteError extends Error {
	constructor(public readonly requestedRoute: string) {
		super(`route "${requestedRoute}" is not supported`);
		this.name = "UnsupportedRouteError";
	}
}

export function router(step: PlanStep): Route {
	if (step.requestedRoute === undefined || step.requestedRoute === "tool") {
		return { kind: "tool" };
	}
	if (step.requestedRoute === "subagent") {
		return { kind: "subagent", role: step.role ?? "coder" };
	}
	throw new UnsupportedRouteError(step.requestedRoute);
}
