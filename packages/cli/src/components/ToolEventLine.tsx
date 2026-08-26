import { Text } from "ink";

export interface ToolEventLineProps {
	name: string;
	phase: "start" | "end";
	ok?: boolean;
}

export function ToolEventLine({ name, phase, ok }: ToolEventLineProps): React.JSX.Element {
	if (phase === "start") {
		return <Text dimColor>▶ {name}…</Text>;
	}
	const mark = ok === false ? "✗" : "✓";
	const color = ok === false ? "red" : "green";
	return (
		<Text color={color}>
			{mark} {name}
		</Text>
	);
}
