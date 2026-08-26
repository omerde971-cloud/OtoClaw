import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "bun:test";
import { MemoryKeyStore } from "../src/keychain-memory";
import {
	MissingApiKeyError,
	UnknownProviderError,
	resolve,
} from "../src/registry";

describe("registry.resolve", () => {
	test("resolves a provider/model spec with an injected key", async () => {
		const keyStore = new MemoryKeyStore();
		await keyStore.set("anthropic", "sk-ant-test");
		const resolved = await resolve("anthropic/claude-sonnet-4-5", keyStore);
		expect(resolved.provider.id).toBe("anthropic");
		expect(resolved.model).toBe("claude-sonnet-4-5");
		expect(resolved.apiKey).toBe("sk-ant-test");
	});

	test("splits only on the first slash so model ids can contain slashes", async () => {
		const keyStore = new MemoryKeyStore();
		await keyStore.set("openrouter", "sk-or-test");
		const resolved = await resolve(
			"openrouter/anthropic/claude-sonnet",
			keyStore,
		);
		expect(resolved.provider.id).toBe("openrouter");
		expect(resolved.model).toBe("anthropic/claude-sonnet");
	});

	test("throws MissingApiKeyError when a key-requiring provider has no stored key", async () => {
		const keyStore = new MemoryKeyStore();
		await expect(
			resolve("anthropic/claude-sonnet-4-5", keyStore),
		).rejects.toBeInstanceOf(MissingApiKeyError);
	});

	test("throws UnknownProviderError for an unregistered provider", async () => {
		const keyStore = new MemoryKeyStore();
		await expect(
			resolve("not-a-provider/some-model", keyStore),
		).rejects.toBeInstanceOf(UnknownProviderError);
	});

	test("local providers that don't require a key resolve without one", async () => {
		const keyStore = new MemoryKeyStore();
		const resolved = await resolve("ollama/llama3", keyStore);
		expect(resolved.provider.id).toBe("ollama");
		expect(resolved.apiKey).toBeNull();
	});

	test("routes claude-cli to the cli-delegate adapter without requiring a key", async () => {
		const keyStore = new MemoryKeyStore();
		const resolved = await resolve("claude-cli/cli-default", keyStore);
		expect(resolved.provider.id).toBe("claude-cli");
		expect(resolved.model).toBe("cli-default");
		expect(resolved.apiKey).toBeNull();
		const models = await resolved.provider.listModels();
		expect(models[0]?.provider).toBe("claude");
	});

	test("routes codex-cli to the cli-delegate adapter without requiring a key", async () => {
		const keyStore = new MemoryKeyStore();
		const resolved = await resolve("codex-cli/cli-default", keyStore);
		expect(resolved.provider.id).toBe("codex-cli");
		const models = await resolved.provider.listModels();
		expect(models[0]?.provider).toBe("codex");
	});
});

describe("registry.resolve — .env priority", () => {
	let dir: string | undefined;

	afterEach(() => {
		if (dir && existsSync(dir)) {
			rmSync(dir, { recursive: true, force: true });
		}
		dir = undefined;
	});

	function writeEnvFile(contents: string): string {
		dir = mkdtempSync(join(tmpdir(), "otoclaw-registry-env-test-"));
		const envPath = join(dir, ".env");
		writeFileSync(envPath, contents);
		return envPath;
	}

	test("prefers a key from .env over one stored in the keychain", async () => {
		const envPath = writeEnvFile("ANTHROPIC: sk-ant-from-env\n");
		const keyStore = new MemoryKeyStore();
		await keyStore.set("anthropic", "sk-ant-from-keychain");

		const resolved = await resolve("anthropic/claude-sonnet-4-5", keyStore, { envPath });
		expect(resolved.apiKey).toBe("sk-ant-from-env");
	});

	test("falls back to the keychain when .env has no entry for the provider", async () => {
		const envPath = writeEnvFile("OPENAI: sk-oai-from-env\n");
		const keyStore = new MemoryKeyStore();
		await keyStore.set("anthropic", "sk-ant-from-keychain");

		const resolved = await resolve("anthropic/claude-sonnet-4-5", keyStore, { envPath });
		expect(resolved.apiKey).toBe("sk-ant-from-keychain");
	});

	test("falls back to the keychain when .env is missing entirely", async () => {
		dir = mkdtempSync(join(tmpdir(), "otoclaw-registry-env-test-"));
		const envPath = join(dir, ".env"); // never written
		const keyStore = new MemoryKeyStore();
		await keyStore.set("anthropic", "sk-ant-from-keychain");

		const resolved = await resolve("anthropic/claude-sonnet-4-5", keyStore, { envPath });
		expect(resolved.apiKey).toBe("sk-ant-from-keychain");
	});

	test("an .env entry with an empty value does not shadow the keychain", async () => {
		const envPath = writeEnvFile("ANTHROPIC:\n");
		const keyStore = new MemoryKeyStore();
		await keyStore.set("anthropic", "sk-ant-from-keychain");

		const resolved = await resolve("anthropic/claude-sonnet-4-5", keyStore, { envPath });
		expect(resolved.apiKey).toBe("sk-ant-from-keychain");
	});

	test("multi-word provider ids map to underscored env keys (lm-studio -> LM_STUDIO)", async () => {
		const envPath = writeEnvFile("LM_STUDIO: sk-lm-from-env\n");
		const keyStore = new MemoryKeyStore();
		const resolved = await resolve("lm-studio/local-model", keyStore, { envPath });
		expect(resolved.apiKey).toBe("sk-lm-from-env");
	});
});
