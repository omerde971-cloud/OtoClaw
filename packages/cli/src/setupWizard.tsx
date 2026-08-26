import { Box, Text, useInput } from "ink";
import { useState } from "react";
import type { WsClient } from "./wsClient";

/** Mirrors packages/providers/src/registry.ts's known provider ids. */
const PROVIDERS = ["anthropic", "openai", "openrouter", "nim", "ollama", "lm-studio"];

type Step = "provider" | "key" | "model" | "mode" | "done";

export interface SetupWizardProps {
	client: WsClient;
	onComplete: () => void;
}

export function SetupWizard({ client, onComplete }: SetupWizardProps): React.JSX.Element {
	const [step, setStep] = useState<Step>("provider");
	const [providerIndex, setProviderIndex] = useState(0);
	const [provider, setProvider] = useState("");
	const [key, setKey] = useState("");
	const [model, setModel] = useState("");
	const [modeIndex, setModeIndex] = useState(0);
	const modes: Array<"manual" | "auto"> = ["manual", "auto"];

	useInput((input, ink) => {
		if (step === "provider") {
			if (ink.upArrow) setProviderIndex((i) => (i - 1 + PROVIDERS.length) % PROVIDERS.length);
			if (ink.downArrow) setProviderIndex((i) => (i + 1) % PROVIDERS.length);
			if (ink.return) {
				setProvider(PROVIDERS[providerIndex]);
				setStep("key");
			}
			return;
		}

		if (step === "key") {
			if (ink.return) {
				void (async () => {
					if (key.length > 0) {
						await client.request("provider.addKey", { provider, key });
					}
					setStep("model");
				})();
				return;
			}
			if (ink.backspace || ink.delete) {
				setKey((k) => k.slice(0, -1));
				return;
			}
			if (input && !ink.ctrl && !ink.meta) setKey((k) => k + input);
			return;
		}

		if (step === "model") {
			if (ink.return) {
				setStep("mode");
				return;
			}
			if (ink.backspace || ink.delete) {
				setModel((m) => m.slice(0, -1));
				return;
			}
			if (input && !ink.ctrl && !ink.meta) setModel((m) => m + input);
			return;
		}

		if (step === "mode") {
			if (ink.upArrow) setModeIndex((i) => (i - 1 + modes.length) % modes.length);
			if (ink.downArrow) setModeIndex((i) => (i + 1) % modes.length);
			if (ink.return) {
				void (async () => {
					const trimmedModel = model.trim();
					await client.request("config.set", {
						patch: {
							mode: modes[modeIndex],
							...(trimmedModel ? { model: `${provider}/${trimmedModel}` } : {}),
						},
					});
					setStep("done");
					onComplete();
				})();
			}
		}
	});

	if (step === "provider") {
		return (
			<Box flexDirection="column" borderStyle="round" paddingX={1}>
				<Text bold>Choose a provider</Text>
				{PROVIDERS.map((p, i) => (
					<Text key={p} color={i === providerIndex ? "cyan" : undefined}>
						{i === providerIndex ? "› " : "  "}
						{p}
					</Text>
				))}
			</Box>
		);
	}

	if (step === "key") {
		return (
			<Box flexDirection="column" borderStyle="round" paddingX={1}>
				<Text bold>API key for {provider}</Text>
				<Text dimColor>(leave empty and press Enter to skip, e.g. for local providers)</Text>
				<Text>
					{"> "}
					{"*".repeat(key.length)}
				</Text>
			</Box>
		);
	}

	if (step === "model") {
		return (
			<Box flexDirection="column" borderStyle="round" paddingX={1}>
				<Text bold>Default model for {provider} (model id only, not "provider/model")</Text>
				<Text>
					{"> "}
					{model}
				</Text>
			</Box>
		);
	}

	if (step === "mode") {
		return (
			<Box flexDirection="column" borderStyle="round" paddingX={1}>
				<Text bold>Default mode</Text>
				{modes.map((m, i) => (
					<Text key={m} color={i === modeIndex ? "cyan" : undefined}>
						{i === modeIndex ? "› " : "  "}
						{m}
					</Text>
				))}
			</Box>
		);
	}

	return <Text>Setup complete.</Text>;
}
