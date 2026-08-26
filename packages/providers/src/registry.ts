import { createAnthropicProvider } from "./anthropic";
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
	adapter: "openai-compat" | "anthropic";
	baseUrl?: string;
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

export async function resolve(
	spec: string,
	keyStore: KeyStore,
): Promise<ResolvedProvider> {
	const [providerId, model] = splitSpec(spec);
	const config = PROVIDER_CONFIGS[providerId];
	if (!config) {
		throw new UnknownProviderError(providerId);
	}

	const apiKey = await keyStore.get(providerId);
	if (config.requiresKey && !apiKey) {
		throw new MissingApiKeyError(providerId);
	}

	const provider: Provider =
		config.adapter === "anthropic"
			? createAnthropicProvider({ apiKey: apiKey ?? undefined })
			: createOpenAICompatProvider({
					id: providerId,
					baseUrl: config.baseUrl ?? "",
					apiKey: apiKey ?? undefined,
				});

	return { provider, model, apiKey };
}
