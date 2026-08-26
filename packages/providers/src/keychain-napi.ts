import { Entry } from "@napi-rs/keyring";
import type { KeyStore } from "./keychain";

const SERVICE = "otoclaw";

export class NapiKeyStore implements KeyStore {
	async get(provider: string): Promise<string | null> {
		const entry = new Entry(SERVICE, provider);
		try {
			return entry.getPassword();
		} catch {
			return null;
		}
	}

	async set(provider: string, key: string): Promise<void> {
		const entry = new Entry(SERVICE, provider);
		entry.setPassword(key);
	}

	async delete(provider: string): Promise<void> {
		const entry = new Entry(SERVICE, provider);
		try {
			entry.deletePassword();
		} catch {
			// already absent
		}
	}
}
