import { Box, Text } from "ink";
import { useEffect, useState } from "react";
import { THEME } from "../theme";
import { CODING_FRAMES, IDLE_FRAMES, THINKING_FRAMES } from "./frames";
import { type RenderedMascotState, toRenderedState } from "./MascotState";

const FRAME_INTERVAL_MS = 150;

function framesFor(state: RenderedMascotState): string[] {
	if (state === "thinking") return THINKING_FRAMES;
	if (state === "coding") return CODING_FRAMES;
	return IDLE_FRAMES;
}

export interface MascotViewProps {
	state: string;
}

export function MascotView({ state }: MascotViewProps): React.JSX.Element {
	const rendered = toRenderedState(state);
	const frames = framesFor(rendered);
	const [frameIndex, setFrameIndex] = useState(0);

	useEffect(() => {
		setFrameIndex(0);
		if (frames.length <= 1) return;
		const timer = setInterval(() => {
			setFrameIndex((i) => (i + 1) % frames.length);
		}, FRAME_INTERVAL_MS);
		return () => clearInterval(timer);
	}, [frames]);

	return (
		<Box flexDirection="column" borderStyle="round" borderColor={THEME.accent} paddingX={1}>
			<Text>{frames[frameIndex % frames.length]}</Text>
			<Text dimColor>{rendered}</Text>
		</Box>
	);
}
