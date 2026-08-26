import { Box, Text, useInput } from "ink";
import { useState } from "react";

export type PermissionDecision = "allow" | "deny" | "always" | "never";

const OPTIONS: { id: PermissionDecision; label: string }[] = [
	{ id: "allow", label: "Allow once" },
	{ id: "deny", label: "Deny once" },
	{ id: "always", label: "Always allow" },
	{ id: "never", label: "Never allow" },
];

export interface PermissionPromptProps {
	tool: string;
	risk: { score: number; reasons: string[] };
	onRespond: (decision: PermissionDecision) => void;
}

export function PermissionPrompt({ tool, risk, onRespond }: PermissionPromptProps): React.JSX.Element {
	const [index, setIndex] = useState(0);

	useInput((_input, key) => {
		if (key.upArrow) setIndex((i) => (i - 1 + OPTIONS.length) % OPTIONS.length);
		if (key.downArrow) setIndex((i) => (i + 1) % OPTIONS.length);
		if (key.return) onRespond(OPTIONS[index].id);
	});

	return (
		<Box flexDirection="column" borderStyle="round" borderColor="yellow" paddingX={1}>
			<Text bold color="yellow">
				Permission requested: {tool} (risk {risk.score})
			</Text>
			{risk.reasons.length > 0 ? <Text dimColor>{risk.reasons.join(", ")}</Text> : null}
			{OPTIONS.map((option, i) => (
				<Text key={option.id} color={i === index ? "cyan" : undefined}>
					{i === index ? "› " : "  "}
					{option.label}
				</Text>
			))}
		</Box>
	);
}
