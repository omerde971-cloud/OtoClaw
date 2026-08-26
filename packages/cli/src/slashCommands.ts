/** Phase 1 slash command surface only — /council /agents /skills /mcp etc. are later phases. */
export type SlashCommandName = "model" | "mode" | "help" | "cost" | "clear";

const KNOWN_COMMANDS: SlashCommandName[] = ["model", "mode", "help", "cost", "clear"];

export interface ParsedSlashCommand {
	command: SlashCommandName;
	args: string[];
}

/** Pure parser — no network/Ink here. Returns null for non-slash input or an unknown command. */
export function parseSlashCommand(input: string): ParsedSlashCommand | null {
	const trimmed = input.trim();
	if (!trimmed.startsWith("/")) return null;

	const parts = trimmed.slice(1).split(/\s+/).filter(Boolean);
	const raw = parts[0]?.toLowerCase();
	if (!raw || !(KNOWN_COMMANDS as string[]).includes(raw)) return null;

	return { command: raw as SlashCommandName, args: parts.slice(1) };
}

export const HELP_TEXT = [
	"/model [name]  - show or set the model (provider/model)",
	"/mode [manual|auto] - show or switch mode",
	"/cost          - show session token + USD usage",
	"/clear         - clear the local conversation view",
	"/help          - show this message",
].join("\n");
