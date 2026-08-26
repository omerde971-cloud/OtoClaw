import { describe, expect, test } from "bun:test";
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
});
