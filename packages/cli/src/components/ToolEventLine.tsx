import { Box, Text } from "ink";
import { formatClock, THEME } from "../theme";

export interface ToolEventLineProps {
	name: string;
	phase: "start" | "end";
	ok?: boolean;
	ts: number;
}

export function ToolEventLine({ name, phase, ok, ts }: ToolEventLineProps): React.JSX.Element {
	const statusColor = phase === "end" ? (ok === false ? THEME.error : THEME.ok) : THEME.dim;
	const statusText = phase === "end" ? (ok === false ? "✗" : "Ok") : "...";

	return (
		<Box>
			<Box flexGrow={1}>
				<Text color={THEME.accent}>[{formatClock(ts)}] </Text>
				<Text dimColor>{"> "}</Text>
				<Text>{name}</Text>
			</Box>
			<Text color={statusColor}>{statusText}</Text>
		</Box>
	);
}
