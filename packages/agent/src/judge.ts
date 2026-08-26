import type { Verdict } from "@otoclaw/shared";
import type { RunContext } from "./types";

export interface JudgeArtifact {
	kind: "code" | "ui" | "text";
	description: string;
	ref: unknown;
}

/**
 * Kept as an interface (not inline params) so a future N-judge council (Phase 2e) can wrap
 * judge() without changing this shape — no council/debate logic here yet.
 */
export interface JudgeInput {
	artifact: JudgeArtifact;
	rubric: string[];
	ctx: RunContext;
	/** Phase 2e: set only by runJudgePanel to focus this single judge call on one lens. */
	lens?: string;
}

/** Fixed default rubric — skill-driven rubrics (Phase 2c) are not wired in yet. */
export const DEFAULT_RUBRIC: string[] = ["derlenir/çalışır mı", "iş gereksinimini karşılıyor mu", "kod stiline uygun mu"];

const JUDGE_SYSTEM_PROMPT = `You are the quality-judgment stage of a coding agent. Score the given artifact against the rubric on a 0-100 scale, label it "good" or "bad", and give short notes explaining the score. Respond with ONLY a JSON object of the form:
{"score":0,"label":"good"|"bad","notes":["..."]}`;

function systemPromptFor(lens?: string): string {
	if (!lens) return JUDGE_SYSTEM_PROMPT;
	return `${JUDGE_SYSTEM_PROMPT}\n\nBu değerlendirmeyi SADECE "${lens}" açısından yap. Diğer açıları görmezden gel.`;
}

export function targetIdOf(artifact: JudgeArtifact): string {
	return typeof artifact.ref === "string" && artifact.ref.length > 0 ? artifact.ref : crypto.randomUUID();
}

function parseVerdict(text: string, targetId: string): Verdict {
	const jsonMatch = text.match(/\{[\s\S]*\}/);
	if (jsonMatch) {
		try {
			const parsed = JSON.parse(jsonMatch[0]) as { score?: unknown; label?: unknown; notes?: unknown };
			const label = parsed.label === "bad" ? "bad" : parsed.label === "good" ? "good" : undefined;
			if (label) {
				const score = typeof parsed.score === "number" ? parsed.score : label === "good" ? 100 : 0;
				const notes = Array.isArray(parsed.notes) ? parsed.notes.filter((n): n is string => typeof n === "string") : [];
				return { id: crypto.randomUUID(), targetId, score, label, notes, createdAt: new Date().toISOString() };
			}
		} catch {
			// fall through to the safe fallback below
		}
	}
	return {
		id: crypto.randomUUID(),
		targetId,
		score: 50,
		label: "good",
		notes: ["judge response could not be parsed; defaulting to a passable verdict"],
		createdAt: new Date().toISOString(),
	};
}

/**
 * Single-judge model turn. Never throws on a malformed response — it falls back to a passable
 * verdict. When judgeCouncil is enabled in globalConfig, delegates to runJudgePanel (Phase 2e)
 * instead — unless input.lens is already set, which means this call IS one of the panel's own
 * per-lens judges and must run the normal single-judge path to avoid recursing forever.
 */
export async function judge(input: JudgeInput): Promise<Verdict> {
	if (input.ctx.globalConfig?.judgeCouncil?.enabled && !input.lens) {
		const { runJudgePanel } = await import("./council");
		return runJudgePanel(input.ctx.globalConfig.judgeCouncil.lenses, input);
	}

	const { artifact, rubric, ctx, lens } = input;
	const rubricText = rubric.map((r) => `- ${r}`).join("\n");

	let text = "";
	for await (const chunk of ctx.provider.chat({
		model: ctx.model,
		messages: [
			{ role: "system", content: systemPromptFor(lens) },
			{
				role: "user",
				content: `Artifact kind: ${artifact.kind}\nDescription: ${artifact.description}\n\nRubric:\n${rubricText}`,
			},
		],
		signal: ctx.signal,
	})) {
		if (chunk.delta) text += chunk.delta;
	}

	return parseVerdict(text, targetIdOf(artifact));
}
