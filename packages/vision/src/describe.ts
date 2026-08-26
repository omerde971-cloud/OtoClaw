import { readFile } from "node:fs/promises";
import type { ChatChunk, Provider } from "@otoclaw/providers";
import { framePath } from "./capture";
import type { DescribeInput, DescribeResult } from "./types";

const DEFAULT_PROMPT = "Describe what is visible on this screen.";

// Placeholder default until the caller wires in the real provider registry/config (§4, §5) —
// resolveProvider lets a daemon-level caller inject the user's configured vision model instead.
const DEFAULT_VISION_MODEL_SPEC = "anthropic/claude-sonnet-4-5";

export type ResolveProvider = (
	spec: string,
) => Promise<{ provider: Provider; model: string }>;

async function defaultResolveProvider(): Promise<{
	provider: Provider;
	model: string;
}> {
	throw new Error(
		"describe() has no vision provider configured — pass resolveProvider to select one",
	);
}

export async function describe(
	input: DescribeInput,
	resolveProvider: ResolveProvider = defaultResolveProvider,
): Promise<DescribeResult> {
	const { provider, model } = await resolveProvider(DEFAULT_VISION_MODEL_SPEC);

	const bytes = await readFile(framePath(input.frameId));
	const base64 = bytes.toString("base64");
	const prompt = input.prompt ?? DEFAULT_PROMPT;

	const chunks: AsyncIterable<ChatChunk> = provider.chat({
		model,
		messages: [
			{
				role: "user",
				content: [
					{ type: "text", text: prompt },
					{ type: "image", data: base64, mimeType: "image/png" },
				],
			},
		],
	});

	let text = "";
	for await (const chunk of chunks) {
		if (chunk.delta) text += chunk.delta;
	}
	return { text };
}
