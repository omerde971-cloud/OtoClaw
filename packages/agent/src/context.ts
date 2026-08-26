import type { ChatMessage, Provider } from "@otoclaw/providers";

/** Number of most-recent messages kept verbatim; anything older is folded into one summary block. */
export const CONTEXT_WINDOW_SIZE = 20;

const SUMMARY_SYSTEM_PROMPT =
	"Summarize the following conversation concisely, preserving key facts, decisions, and open questions. Respond with plain text only.";

async function summarize(
	older: ChatMessage[],
	provider: Provider,
	model: string,
	signal?: AbortSignal,
): Promise<string> {
	const transcript = older.map((m) => `${m.role}: ${m.content}`).join("\n");
	let text = "";
	for await (const chunk of provider.chat({
		model,
		messages: [
			{ role: "system", content: SUMMARY_SYSTEM_PROMPT },
			{ role: "user", content: transcript },
		],
		signal,
	})) {
		if (chunk.delta) text += chunk.delta;
	}
	return text.trim();
}

/**
 * Rolling context window: the last CONTEXT_WINDOW_SIZE messages stay raw, everything older is
 * collapsed into a single system-role summary block via a dedicated model turn.
 */
export async function buildContextWindow(
	messages: ChatMessage[],
	provider: Provider,
	model: string,
	signal?: AbortSignal,
): Promise<ChatMessage[]> {
	if (messages.length <= CONTEXT_WINDOW_SIZE) return messages;

	const older = messages.slice(0, messages.length - CONTEXT_WINDOW_SIZE);
	const recent = messages.slice(messages.length - CONTEXT_WINDOW_SIZE);
	const summary = await summarize(older, provider, model, signal);

	return [{ role: "system", content: `Summary of earlier conversation:\n${summary}` }, ...recent];
}
