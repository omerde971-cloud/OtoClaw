import { describe, expect, test } from "bun:test";
import { router, UnsupportedRouteError } from "../src/router";
import type { PlanStep } from "../src/types";

function makeStep(overrides: Partial<PlanStep> = {}): PlanStep {
	return { id: "step-1", description: "do the thing", kind: "tool", acceptance: [], ...overrides };
}

describe("router", () => {
	test("routes a plain step to the tool route", () => {
		const route = router(makeStep());
		expect(route).toEqual({ kind: "tool" });
	});

	test("routes a code step to the tool route too (codeTestDebug is layered on top, not a separate route)", () => {
		const route = router(makeStep({ kind: "code" }));
		expect(route).toEqual({ kind: "tool" });
	});

	test("rejects a step that explicitly requests the subagent route — Phase 1 does not implement sub-agent orchestration", () => {
		const step = makeStep({ requestedRoute: "subagent" });
		expect(() => router(step)).toThrow(UnsupportedRouteError);
		try {
			router(step);
			throw new Error("expected router to throw");
		} catch (err) {
			expect(err).toBeInstanceOf(UnsupportedRouteError);
			expect((err as UnsupportedRouteError).requestedRoute).toBe("subagent");
			expect((err as Error).message).toMatch(/not supported in Phase 1/);
		}
	});
});
