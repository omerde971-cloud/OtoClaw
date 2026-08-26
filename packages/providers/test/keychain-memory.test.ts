import { describe, expect, test } from "bun:test";
import { MemoryKeyStore } from "../src/keychain-memory";

describe("MemoryKeyStore", () => {
	test("returns null for unknown provider", async () => {
		const store = new MemoryKeyStore();
		expect(await store.get("openai")).toBeNull();
	});

	test("set then get returns the stored key", async () => {
		const store = new MemoryKeyStore();
		await store.set("openai", "sk-test-123");
		expect(await store.get("openai")).toBe("sk-test-123");
	});

	test("delete removes the stored key", async () => {
		const store = new MemoryKeyStore();
		await store.set("openai", "sk-test-123");
		await store.delete("openai");
		expect(await store.get("openai")).toBeNull();
	});

	test("keys are isolated per provider", async () => {
		const store = new MemoryKeyStore();
		await store.set("openai", "key-a");
		await store.set("anthropic", "key-b");
		expect(await store.get("openai")).toBe("key-a");
		expect(await store.get("anthropic")).toBe("key-b");
	});
});
