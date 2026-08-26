import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type Config, ConfigSchema } from "@otoclaw/shared";
import { otoclawDir } from "./store";

export function configPath(): string {
	return join(otoclawDir(), "config.json");
}

export function loadConfig(): Config {
	const path = configPath();
	if (!existsSync(path)) {
		return ConfigSchema.parse({});
	}
	try {
		return ConfigSchema.parse(JSON.parse(readFileSync(path, "utf8")));
	} catch {
		return ConfigSchema.parse({});
	}
}

export function saveConfig(config: Config): void {
	writeFileSync(configPath(), JSON.stringify(config, null, 2));
}
