import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type Config, ConfigSchema, loadEnvFile } from "@otoclaw/shared";
import { otoclawDir } from "./store";

export function configPath(): string {
	return join(otoclawDir(), "config.json");
}

export function loadConfig(): Config {
	const path = configPath();
	let config: Config;
	if (!existsSync(path)) {
		config = ConfigSchema.parse({});
	} else {
		try {
			config = ConfigSchema.parse(JSON.parse(readFileSync(path, "utf8")));
		} catch {
			config = ConfigSchema.parse({});
		}
	}
	// config.json's `model` wins when set; `.env`'s `MODEL:` line is only a fallback
	// default for a project that hasn't configured one yet.
	if (!config.model) {
		const envModel = loadEnvFile().MODEL;
		if (envModel) {
			config = { ...config, model: envModel };
		}
	}
	return config;
}

export function saveConfig(config: Config): void {
	writeFileSync(configPath(), JSON.stringify(config, null, 2));
}
