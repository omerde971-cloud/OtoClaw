import { Box, Text, useInput } from "ink";
import { useCallback, useEffect, useRef, useState } from "react";
import { PermissionPrompt } from "./components/PermissionPrompt";
import { QuestionPrompt } from "./components/QuestionPrompt";
import { StreamingMessage } from "./components/StreamingMessage";
import { ToolEventLine } from "./components/ToolEventLine";
import { MascotView } from "./mascot/MascotView";
import { SetupWizard } from "./setupWizard";
import { HELP_TEXT, parseSlashCommand } from "./slashCommands";
import type { WsClient } from "./wsClient";

interface TranscriptEntry {
	id: string;
	kind: "user" | "assistant" | "system" | "tool";
	text: string;
	ok?: boolean;
}

interface PendingPermission {
	requestId: string;
	tool: string;
	risk: { score: number; reasons: string[] };
}

interface PendingQuestion {
	questionId: string;
	header: string;
	question: string;
	options: { id: string; label: string; description?: string }[];
	allowFreeText?: boolean;
}

interface CostState {
	tokensIn: number;
	tokensOut: number;
	usd: number;
}

export interface AppProps {
	client: WsClient;
	cwd: string;
}

let entryCounter = 0;
function nextId(): string {
	entryCounter += 1;
	return `entry-${entryCounter}`;
}

export function App({ client, cwd }: AppProps): React.JSX.Element {
	const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);
	const [sessionId, setSessionId] = useState<string | null>(null);
	const [mode, setMode] = useState<"manual" | "auto">("manual");
	const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
	const [streamText, setStreamText] = useState("");
	const [streaming, setStreaming] = useState(false);
	const [mascotState, setMascotState] = useState("idle");
	const [pendingPermission, setPendingPermission] = useState<PendingPermission | null>(null);
	const [pendingQuestion, setPendingQuestion] = useState<PendingQuestion | null>(null);
	const [cost, setCost] = useState<CostState | null>(null);
	const [inputValue, setInputValue] = useState("");
	const sessionIdRef = useRef<string | null>(null);

	const pushEntry = useCallback((entry: Omit<TranscriptEntry, "id">): void => {
		setTranscript((t) => [...t, { ...entry, id: nextId() }]);
	}, []);

	useEffect(() => {
		let cancelled = false;

		void (async () => {
			await client.connect();
			const config = await client.request<{ mode?: "manual" | "auto"; model?: string }>("config.get", {});
			if (cancelled) return;
			setNeedsSetup(!config.model);
			setMode(config.mode ?? "manual");

			const { sessionId: newSessionId } = await client.request<{ sessionId: string }>("session.create", {
				cwd,
				mode: config.mode ?? "manual",
			});
			if (cancelled) return;
			sessionIdRef.current = newSessionId;
			setSessionId(newSessionId);
			if (config.model) {
				await client.request("model.set", { sessionId: newSessionId, model: config.model });
			}
		})();

		const unsubscribers = [
			client.on("stream.delta", (params) => {
				const p = params as { sessionId: string; text: string };
				if (p.sessionId !== sessionIdRef.current) return;
				setStreaming(true);
				setStreamText((t) => t + p.text);
			}),
			client.on("pipeline.stage", (params) => {
				const p = params as { sessionId: string; stage: string };
				if (p.sessionId !== sessionIdRef.current) return;
				if (p.stage === "intake") {
					setStreamText("");
					setStreaming(true);
				}
				if (p.stage === "deliver") {
					setStreaming(false);
					setStreamText((current) => {
						if (current) pushEntry({ kind: "assistant", text: current });
						return "";
					});
				}
			}),
			client.on("tool.start", (params) => {
				const p = params as { sessionId: string; name: string };
				if (p.sessionId !== sessionIdRef.current) return;
				pushEntry({ kind: "tool", text: p.name });
			}),
			client.on("tool.end", (params) => {
				const p = params as { sessionId: string; name: string; result?: { ok?: boolean } };
				if (p.sessionId !== sessionIdRef.current) return;
				pushEntry({ kind: "tool", text: p.name, ok: p.result?.ok !== false });
			}),
			client.on("permission.request", (params) => {
				const p = params as PendingPermission & { sessionId: string };
				if (p.sessionId !== sessionIdRef.current) return;
				setPendingPermission({ requestId: p.requestId, tool: p.tool, risk: p.risk });
			}),
			client.on("question.ask", (params) => {
				const p = params as PendingQuestion & { sessionId: string };
				if (p.sessionId !== sessionIdRef.current) return;
				setPendingQuestion({
					questionId: p.questionId,
					header: p.header,
					question: p.question,
					options: p.options,
					allowFreeText: p.allowFreeText,
				});
			}),
			client.on("mascot.state", (params) => {
				const p = params as { sessionId: string; state: string };
				if (p.sessionId !== sessionIdRef.current) return;
				setMascotState(p.state);
			}),
			client.on("cost.update", (params) => {
				const p = params as CostState & { sessionId: string };
				if (p.sessionId !== sessionIdRef.current) return;
				setCost({ tokensIn: p.tokensIn, tokensOut: p.tokensOut, usd: p.usd });
			}),
			client.on("error", (params) => {
				const p = params as { sessionId?: string; message: string };
				if (p.sessionId && p.sessionId !== sessionIdRef.current) return;
				pushEntry({ kind: "system", text: `error: ${p.message}` });
			}),
		];

		return () => {
			cancelled = true;
			for (const unsubscribe of unsubscribers) unsubscribe();
		};
	}, [client, cwd, pushEntry]);

	async function handleSubmit(text: string): Promise<void> {
		if (!sessionId) return;
		const slash = parseSlashCommand(text);
		if (slash) {
			if (slash.command === "help") {
				pushEntry({ kind: "system", text: HELP_TEXT });
			} else if (slash.command === "clear") {
				setTranscript([]);
			} else if (slash.command === "cost") {
				pushEntry({
					kind: "system",
					text: cost ? `tokens in=${cost.tokensIn} out=${cost.tokensOut} $${cost.usd.toFixed(4)}` : "no cost data yet",
				});
			} else if (slash.command === "mode") {
				if (slash.args[0] === "manual" || slash.args[0] === "auto") {
					await client.request("mode.set", { sessionId, mode: slash.args[0] });
					setMode(slash.args[0]);
					pushEntry({ kind: "system", text: `mode set to ${slash.args[0]}` });
				} else {
					pushEntry({ kind: "system", text: `mode: ${mode}` });
				}
			} else if (slash.command === "model") {
				if (slash.args[0]) {
					await client.request("model.set", { sessionId, model: slash.args[0] });
					pushEntry({ kind: "system", text: `model set to ${slash.args[0]}` });
				} else {
					const models = await client.request<Array<{ id: string; provider: string }>>("model.list", {});
					pushEntry({
						kind: "system",
						text: models.length ? models.map((m) => `${m.provider}/${m.id}`).join("\n") : "no models available",
					});
				}
			}
			return;
		}

		pushEntry({ kind: "user", text });
		await client.request("message.send", { sessionId, text });
	}

	useInput((input, key) => {
		if (pendingPermission || pendingQuestion) return;
		if (key.return) {
			const text = inputValue;
			setInputValue("");
			void handleSubmit(text);
			return;
		}
		if (key.backspace || key.delete) {
			setInputValue((v) => v.slice(0, -1));
			return;
		}
		if (input && !key.ctrl && !key.meta) {
			setInputValue((v) => v + input);
		}
	});

	if (needsSetup === null) {
		return <Text dimColor>connecting…</Text>;
	}

	if (needsSetup) {
		return <SetupWizard client={client} onComplete={() => setNeedsSetup(false)} />;
	}

	return (
		<Box flexDirection="column">
			<MascotView state={mascotState} />
			<Box flexDirection="column" marginTop={1}>
				{transcript.map((entry) => {
					if (entry.kind === "tool") {
						return <ToolEventLine key={entry.id} name={entry.text} phase={entry.ok === undefined ? "start" : "end"} ok={entry.ok} />;
					}
					return (
						<Text key={entry.id} dimColor={entry.kind === "system"}>
							{entry.kind === "user" ? "> " : ""}
							{entry.text}
						</Text>
					);
				})}
				<StreamingMessage text={streamText} streaming={streaming} />
			</Box>
			{pendingPermission ? (
				<PermissionPrompt
					tool={pendingPermission.tool}
					risk={pendingPermission.risk}
					onRespond={(decision) => {
						void client.request("permission.respond", { requestId: pendingPermission.requestId, decision });
						setPendingPermission(null);
					}}
				/>
			) : null}
			{pendingQuestion ? (
				<QuestionPrompt
					header={pendingQuestion.header}
					question={pendingQuestion.question}
					options={pendingQuestion.options}
					allowFreeText={pendingQuestion.allowFreeText}
					onRespond={(answer) => {
						void client.request("question.respond", { questionId: pendingQuestion.questionId, ...answer });
						setPendingQuestion(null);
					}}
				/>
			) : null}
			{!pendingPermission && !pendingQuestion ? (
				<Box marginTop={1}>
					<Text dimColor>[{mode}] </Text>
					<Text>{"> "}</Text>
					<Text>{inputValue}</Text>
					<Text dimColor>▍</Text>
				</Box>
			) : null}
		</Box>
	);
}
