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

	test("accepts a step that requests the subagent route, carrying its role through", () => {
		const route = router(makeStep({ requestedRoute: "subagent", role: "researcher" }));
		expect(route).toEqual({ kind: "subagent", role: "researcher" });
	});

	test("defaults a subagent step's role to coder when the planner omits it", () => {
		const route = router(makeStep({ requestedRoute: "subagent" }));
		expect(route).toEqual({ kind: "subagent", role: "coder" });
	});

	test("throws UnsupportedRouteError for a genuinely unknown route string", () => {
		const step = makeStep({ requestedRoute: "bogus" as unknown as PlanStep["requestedRoute"] });
		expect(() => router(step)).toThrow(UnsupportedRouteError);
		try {
			router(step);
			throw new Error("expected router to throw");
		} catch (err) {
			expect(err).toBeInstanceOf(UnsupportedRouteError);
			expect((err as UnsupportedRouteError).requestedRoute).toBe("bogus");
		}
	});
});
