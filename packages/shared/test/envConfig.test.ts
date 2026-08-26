import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "bun:test";
import { loadEnvFile, parseColonEnv } from "../src/envConfig";

describe("parseColonEnv", () => {
	test("parses normal NAME: value lines", () => {
		const parsed = parseColonEnv("ANTHROPIC: sk-ant-mock-1234\nOPENAI: sk-oai-mock-5678\n");
		expect(parsed).toEqual({
			ANTHROPIC: "sk-ant-mock-1234",
			OPENAI: "sk-oai-mock-5678",
		});
	});

	test("skips comment lines", () => {
		const parsed = parseColonEnv("# this is a comment\nANTHROPIC: sk-ant-mock\n# another comment\n");
		expect(parsed).toEqual({ ANTHROPIC: "sk-ant-mock" });
	});

	test("skips blank lines", () => {
		const parsed = parseColonEnv("\n\nANTHROPIC: sk-ant-mock\n\n\nOPENAI: sk-oai-mock\n\n");
		expect(parsed).toEqual({ ANTHROPIC: "sk-ant-mock", OPENAI: "sk-oai-mock" });
	});

	test("skips lines with an empty value (not yet filled in)", () => {
		const parsed = parseColonEnv("ANTHROPIC:\nOPENAI: sk-oai-mock\nGITHUB:   \n");
		expect(parsed).toEqual({ OPENAI: "sk-oai-mock" });
	});

	test("only splits on the first colon, so values containing ':' parse correctly", () => {
		const parsed = parseColonEnv("OLLAMA: http://localhost:11434/v1\n");
		expect(parsed).toEqual({ OLLAMA: "http://localhost:11434/v1" });
	});

	test("returns an empty object for empty content", () => {
		expect(parseColonEnv("")).toEqual({});
	});
});

describe("loadEnvFile", () => {
	let dir: string | undefined;

	afterEach(() => {
		if (dir && existsSync(dir)) {
			rmSync(dir, { recursive: true, force: true });
		}
		dir = undefined;
	});

	test("returns an empty object when the file does not exist", () => {
		dir = mkdtempSync(join(tmpdir(), "otoclaw-env-test-"));
		const parsed = loadEnvFile(join(dir, "missing.env"));
		expect(parsed).toEqual({});
	});

	test("reads and parses an existing file", () => {
		dir = mkdtempSync(join(tmpdir(), "otoclaw-env-test-"));
		const path = join(dir, ".env");
		writeFileSync(path, "ANTHROPIC: sk-ant-mock-abcd\nMODEL: anthropic/claude-sonnet-5\n");
		const parsed = loadEnvFile(path);
		expect(parsed).toEqual({
			ANTHROPIC: "sk-ant-mock-abcd",
			MODEL: "anthropic/claude-sonnet-5",
		});
	});
});
