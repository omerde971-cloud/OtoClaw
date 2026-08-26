import { randomUUID } from "node:crypto";
import type { QuestionAnswer, QuestionChannel, QuestionSpec, TaskIntake } from "./types";

/** Below this length a request is treated as too ambiguous to plan from without asking. */
const MIN_TASK_TEXT_LENGTH = 3;

/**
 * First-understanding pass. Blocks on `questionChannel.ask` only when the request is too
 * sparse to plan from; real ambiguity/taste judgment is out of scope for Phase 1.
 */
export async function intake(userText: string, questionChannel: QuestionChannel): Promise<TaskIntake> {
	const trimmed = userText.trim();
	if (trimmed.length >= MIN_TASK_TEXT_LENGTH) {
		return { userText: trimmed };
	}

	const answer = await questionChannel.ask({
		questionId: randomUUID(),
		header: "Need more detail",
		question: "Your request is too short to act on — what would you like me to do?",
		options: [],
		allowFreeText: true,
	});

	const clarification = (answer.freeText ?? answer.optionId ?? "").trim();
	return { userText: clarification || trimmed, clarification };
}

/** Deterministic stub for tests: returns a scripted answer without waiting on real input. */
export class StubQuestionChannel implements QuestionChannel {
	readonly asked: QuestionSpec[] = [];

	constructor(private readonly answer: QuestionAnswer) {}

	async ask(spec: QuestionSpec): Promise<QuestionAnswer> {
		this.asked.push(spec);
		return this.answer;
	}
}
