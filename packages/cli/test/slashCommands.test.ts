import { describe, expect, test } from "bun:test";
import { parseSlashCommand } from "../src/slashCommands";

describe("parseSlashCommand", () => {
	test("parses a bare command with no args", () => {
		expect(parseSlashCommand("/help")).toEqual({ command: "help", args: [] });
	});

	test("parses a command with args", () => {
		expect(parseSlashCommand("/model anthropic/claude-3-5-sonnet")).toEqual({
			command: "model",
			args: ["anthropic/claude-3-5-sonnet"],
		});
	});

	test("is case-insensitive on the command name", () => {
		expect(parseSlashCommand("/MODE auto")).toEqual({ command: "mode", args: ["auto"] });
	});

	test("trims surrounding whitespace", () => {
		expect(parseSlashCommand("   /cost   ")).toEqual({ command: "cost", args: [] });
	});

	test("collapses repeated whitespace between args", () => {
		expect(parseSlashCommand("/mode   auto")).toEqual({ command: "mode", args: ["auto"] });
	});

	test("returns null for plain text", () => {
		expect(parseSlashCommand("hello there")).toBeNull();
	});

	test("returns null for an unknown command", () => {
		expect(parseSlashCommand("/council on")).toBeNull();
	});

	test("returns null for a bare slash", () => {
		expect(parseSlashCommand("/")).toBeNull();
	});
});
