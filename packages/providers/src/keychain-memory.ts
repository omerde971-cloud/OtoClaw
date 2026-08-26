import type { KeyStore } from "./keychain";

export class MemoryKeyStore implements KeyStore {
	private readonly store = new Map<string, string>();

	async get(provider: string): Promise<string | null> {
		return this.store.get(provider) ?? null;
	}

	async set(provider: string, key: string): Promise<void> {
		this.store.set(provider, key);
	}

	async delete(provider: string): Promise<void> {
		this.store.delete(provider);
	}
}
