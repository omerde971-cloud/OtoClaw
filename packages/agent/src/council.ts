import type { Verdict } from "@otoclaw/shared";
import { judge, targetIdOf, type JudgeInput } from "./judge";

/**
 * Phase 2e — runs one judge() per lens (different system prompt each, e.g. "correctness",
 * "functional", "aesthetics"), in parallel, then combines the labels by majority vote.
 *
 * Tie-break: when a panel has an even lens count and votes split evenly, the result is "bad" —
 * the safer default, since accepting a borderline artifact costs more than one extra repair pass.
 * The default 3-lens panel is odd-sized so this only matters for a caller-supplied even panel.
 */
export async function runJudgePanel(lenses: string[], input: JudgeInput): Promise<Verdict> {
	const verdicts = await Promise.all(lenses.map((lens) => judge({ ...input, lens })));

	const goodCount = verdicts.filter((v) => v.label === "good").length;
	const badCount = verdicts.length - goodCount;
	const label: "good" | "bad" = goodCount > badCount ? "good" : "bad";

	const score = Math.round(verdicts.reduce((sum, v) => sum + v.score, 0) / verdicts.length);
	const notes = verdicts.flatMap((v, i) => v.notes.map((n) => `[${lenses[i]}]: ${n}`));

	return {
		id: crypto.randomUUID(),
		targetId: targetIdOf(input.artifact),
		score,
		label,
		notes,
		createdAt: new Date().toISOString(),
	};
}
