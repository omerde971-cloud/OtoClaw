import { Box, Text, useInput } from "ink";
import { useState } from "react";

export interface QuestionOption {
	id: string;
	label: string;
	description?: string;
}

export interface QuestionPromptProps {
	header: string;
	question: string;
	options: QuestionOption[];
	allowFreeText?: boolean;
	onRespond: (answer: { optionId?: string; freeText?: string }) => void;
}

const FREE_TEXT_ID = "__free_text__";

/** ARCHITECTURE.md §16 button-prompt UI: arrow-key selectable list, Enter to confirm. */
export function QuestionPrompt({
	header,
	question,
	options,
	allowFreeText,
	onRespond,
}: QuestionPromptProps): React.JSX.Element {
	const items = allowFreeText ? [...options, { id: FREE_TEXT_ID, label: "Other (type your own)…" }] : options;
	const [index, setIndex] = useState(0);
	const [freeTextMode, setFreeTextMode] = useState(false);
	const [freeText, setFreeText] = useState("");

	useInput((input, key) => {
		if (freeTextMode) {
			if (key.return) {
				onRespond({ freeText });
				return;
			}
			if (key.backspace || key.delete) {
				setFreeText((t) => t.slice(0, -1));
				return;
			}
			if (input && !key.ctrl && !key.meta) {
				setFreeText((t) => t + input);
			}
			return;
		}

		if (key.upArrow) setIndex((i) => (i - 1 + items.length) % items.length);
		if (key.downArrow) setIndex((i) => (i + 1) % items.length);
		if (key.return) {
			const selected = items[index];
			if (selected.id === FREE_TEXT_ID) {
				setFreeTextMode(true);
				return;
			}
			onRespond({ optionId: selected.id });
		}
	});

	return (
		<Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1}>
			<Text bold color="cyan">
				{header}
			</Text>
			<Text>{question}</Text>
			{freeTextMode ? (
				<Text>
					{"> "}
					{freeText}
					<Text dimColor>▍</Text>
				</Text>
			) : (
				items.map((item, i) => (
					<Text key={item.id} color={i === index ? "cyan" : undefined}>
						{i === index ? "› " : "  "}
						{item.label}
					</Text>
				))
			)}
		</Box>
	);
}
