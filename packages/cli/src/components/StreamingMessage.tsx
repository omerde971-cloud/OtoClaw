import { Box, Text } from "ink";

export interface StreamingMessageProps {
	text: string;
	streaming: boolean;
}

export function StreamingMessage({ text, streaming }: StreamingMessageProps): React.JSX.Element {
	if (!text) return <Box />;
	return (
		<Box>
			<Text>{text}</Text>
			{streaming ? <Text dimColor>▍</Text> : null}
		</Box>
	);
}
