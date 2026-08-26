import { loadEnvFile } from "@otoclaw/shared";
import { createAnthropicProvider } from "./anthropic";
import { createCliDelegateProvider } from "./cli-delegate";
import type { KeyStore } from "./keychain";
import { createOpenAICompatProvider } from "./openai-compat";
import type { Provider } from "./types";

export class MissingApiKeyError extends Error {
	constructor(public readonly providerId: string) {
		super(`no API key stored for provider "${providerId}"`);
		this.name = "MissingApiKeyError";
	}
}

export class UnknownProviderError extends Error {
	constructor(public readonly providerId: string) {
		super(`unknown provider "${providerId}"`);
		this.name = "UnknownProviderError";
	}
}

interface ProviderConfig {
	adapter: "openai-compat" | "anthropic" | "cli-delegate";
	baseUrl?: string;
	cliBinary?: "claude" | "codex";
	requiresKey: boolean;
}

const PROVIDER_CONFIGS: Record<string, ProviderConfig> = {
	anthropic: { adapter: "anthropic", requiresKey: true },
	openrouter: {
		adapter: "openai-compat",
		baseUrl: "https://openrouter.ai/api/v1",
		requiresKey: true,
	},
	nim: {
		adapter: "openai-compat",
		baseUrl: "https://integrate.api.nvidia.com/v1",
		requiresKey: true,
	},
	ollama: {
		adapter: "openai-compat",
		baseUrl: "http://localhost:11434/v1",
		requiresKey: false,
	},
	"lm-studio": {
		adapter: "openai-compat",
		baseUrl: "http://localhost:1234/v1",
		requiresKey: false,
	},
	openai: {
		adapter: "openai-compat",
		baseUrl: "https://api.openai.com/v1",
		requiresKey: true,
	},
	"claude-cli": {
		adapter: "cli-delegate",
		cliBinary: "claude",
		requiresKey: false,
	},
	"codex-cli": {
		adapter: "cli-delegate",
		cliBinary: "codex",
		requiresKey: false,
	},
};

/** Provider ids known to the registry, exposed for callers (e.g. model.list) that need to enumerate them. */
export const KNOWN_PROVIDER_IDS: string[] = Object.keys(PROVIDER_CONFIGS);

export interface ResolvedProvider {
	provider: Provider;
	model: string;
	apiKey: string | null;
}

/** Splits a "provider/model" spec into [providerId, model], where model may itself contain slashes. */
function splitSpec(spec: string): [string, string] {
	const slashIndex = spec.indexOf("/");
	if (slashIndex === -1) {
		throw new Error(`invalid model spec "${spec}", expected "provider/model"`);
	}
	return [spec.slice(0, slashIndex), spec.slice(slashIndex + 1)];
}

/** Maps a provider id (e.g. "lm-studio") to its `.env` key name (e.g. "LM_STUDIO"). */
function envKeyName(providerId: string): string {
	return providerId.toUpperCase().replace(/-/g, "_");
}

export interface ResolveOptions {
	/** Overrides where the `.env` file is read from — used by tests so they never touch the real project `.env`. */
	envPath?: string;
}

export async function resolve(
	spec: string,
	keyStore: KeyStore,
	options: ResolveOptions = {},
): Promise<ResolvedProvider> {
	const [providerId, model] = splitSpec(spec);
	const config = PROVIDER_CONFIGS[providerId];
	if (!config) {
		throw new UnknownProviderError(providerId);
	}

	// `.env` (project root, "PROVIDER: key" lines) takes priority over the OS keychain so
	// a plain-text .env — if the user opts into one — always wins; the keychain remains the
	// fallback for anyone still using `provider.addKey` / the setup wizard.
	const envVars = loadEnvFile(options.envPath);
	const envKey = envVars[envKeyName(providerId)];
	const apiKey = envKey && envKey.length > 0 ? envKey : await keyStore.get(providerId);
	if (config.requiresKey && !apiKey) {
		throw new MissingApiKeyError(providerId);
	}

	let provider: Provider;
	if (config.adapter === "anthropic") {
		provider = createAnthropicProvider({ apiKey: apiKey ?? undefined });
	} else if (config.adapter === "cli-delegate") {
		provider = createCliDelegateProvider({
			binary: config.cliBinary ?? "claude",
			id: providerId,
		});
	} else {
		provider = createOpenAICompatProvider({
			id: providerId,
			baseUrl: config.baseUrl ?? "",
			apiKey: apiKey ?? undefined,
		});
	}

	return { provider, model, apiKey };
}
