import type { Provider } from "@otoclaw/providers";
import type { Plan, PlanStep, TaskIntake } from "./types";

const PLANNER_SYSTEM_PROMPT = `You are the planning stage of a coding agent. Respond with ONLY a JSON object of the form:
{"steps":[{"id":"step-1","description":"...","kind":"tool"|"code","acceptance":["..."]}]}
Each step is ordered. Use "code" only for steps that write and then must be tested; use "tool" otherwise.`;

function normalizeStep(raw: unknown, index: number): PlanStep {
	const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
	const kind = obj.kind === "code" ? "code" : "tool";
	const requestedRoute = obj.requestedRoute === "subagent" ? "subagent" : obj.requestedRoute === "tool" ? "tool" : undefined;
	return {
		id: typeof obj.id === "string" && obj.id.length > 0 ? obj.id : `step-${index + 1}`,
		description: typeof obj.description === "string" && obj.description.length > 0 ? obj.description : "",
		kind,
		acceptance: Array.isArray(obj.acceptance) ? obj.acceptance.filter((a): a is string => typeof a === "string") : [],
		requestedRoute,
	};
}

function parsePlan(text: string, fallbackDescription: string): Plan {
	const jsonMatch = text.match(/\{[\s\S]*\}/);
	if (jsonMatch) {
		try {
			const parsed = JSON.parse(jsonMatch[0]) as { steps?: unknown[] };
			if (Array.isArray(parsed.steps) && parsed.steps.length > 0) {
				return { steps: parsed.steps.map((s, i) => normalizeStep(s, i)) };
			}
		} catch {
			// fall through to the single-step fallback below
		}
	}
	return {
		steps: [
			{
				id: "step-1",
				description: fallbackDescription,
				kind: "tool",
				acceptance: [],
			},
		],
	};
}

/** Model turn that produces an ordered Plan (steps + acceptance checks) from the intake. */
export async function planner(
	taskIntake: TaskIntake,
	provider: Provider,
	model: string,
	signal?: AbortSignal,
): Promise<Plan> {
	let text = "";
	for await (const chunk of provider.chat({
		model,
		messages: [
			{ role: "system", content: PLANNER_SYSTEM_PROMPT },
			{ role: "user", content: taskIntake.userText },
		],
		signal,
	})) {
		if (chunk.delta) text += chunk.delta;
	}
	return parsePlan(text, taskIntake.userText.trim() || "complete the requested task");
}
