import { Box, Text, useInput } from "ink";
import { useState } from "react";
import { assignShortcuts, THEME } from "../theme";

export type PermissionDecision = "allow" | "deny" | "always" | "never";

const OPTIONS: { id: PermissionDecision; label: string }[] = [
	{ id: "allow", label: "Allow once" },
	{ id: "deny", label: "Deny once" },
	{ id: "always", label: "Always allow" },
	{ id: "never", label: "Never allow" },
];

const SHORTCUTS = assignShortcuts(OPTIONS.map((o) => o.label));

export interface PermissionPromptProps {
	tool: string;
	risk: { score: number; reasons: string[] };
	onRespond: (decision: PermissionDecision) => void;
}

export function PermissionPrompt({ tool, risk, onRespond }: PermissionPromptProps): React.JSX.Element {
	const [index, setIndex] = useState(0);

	useInput((input, key) => {
		if (key.upArrow) setIndex((i) => (i - 1 + OPTIONS.length) % OPTIONS.length);
		if (key.downArrow) setIndex((i) => (i + 1) % OPTIONS.length);
		if (key.return) onRespond(OPTIONS[index].id);

		const pressed = input.toUpperCase();
		const shortcutIndex = SHORTCUTS.indexOf(pressed);
		if (shortcutIndex !== -1) onRespond(OPTIONS[shortcutIndex].id);
	});

	return (
		<Box flexDirection="column" borderStyle="round" borderColor={THEME.accent} paddingX={1}>
			<Text bold color={THEME.accent}>
				=== EYLEM ONAYI GEREKİYOR ===
			</Text>
			<Text>
				Araç: <Text bold>{tool}</Text> (risk {risk.score})
			</Text>
			{risk.reasons.length > 0 ? <Text dimColor>{risk.reasons.join(", ")}</Text> : null}
			{OPTIONS.map((option, i) => (
				<Text key={option.id} color={i === index ? THEME.accentBright : undefined}>
					{i === index ? "› " : "  "}
					[{SHORTCUTS[i]}] {option.label}
				</Text>
			))}
		</Box>
	);
}
