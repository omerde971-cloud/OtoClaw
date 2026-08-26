import { readFile } from "node:fs/promises";
import { type Config, ConfigSchema, type Policy, PolicySchema } from "@otoclaw/shared";
import type { PermissionDecision, PolicyResolution, SessionOverrides } from "./types";

/** Permission keys whose decision lives directly on the per-project Policy shape. */
const POLICY_FIELD_BY_PERMISSION_KEY: Partial<Record<string, keyof Policy>> = {
	shell: "shell",
	"fs.write": "fs.write",
	"web.fetch": "web.fetch",
	browser: "browser",
	vision: "vision",
	github: "github",
};

export interface ResolvePolicyInput {
	permissionKey: string;
	toolDefault: PermissionDecision;
	sessionOverrides?: SessionOverrides;
	projectPolicy?: Policy | null;
	globalConfig?: Config | null;
}

/**
 * Resolution order: session override -> project `.otoclaw/policy.json` ->
 * global `config.json` -> tool default. See ARCHITECTURE.md §8.
 */
export function resolvePolicy(input: ResolvePolicyInput): PolicyResolution {
	const sessionDecision = input.sessionOverrides?.[input.permissionKey];
	if (sessionDecision !== undefined) {
		return { decision: sessionDecision, source: "session" };
	}

	const policyField = POLICY_FIELD_BY_PERMISSION_KEY[input.permissionKey];
	const projectDecision = policyField ? input.projectPolicy?.[policyField] : undefined;
	if (typeof projectDecision === "string") {
		return { decision: projectDecision, source: "project-policy" };
	}

	const globalDecision = input.globalConfig?.permissions?.[input.permissionKey];
	if (globalDecision !== undefined) {
		return { decision: globalDecision, source: "global-config" };
	}

	return { decision: input.toolDefault, source: "tool-default" };
}

export async function loadProjectPolicy(policyPath: string): Promise<Policy | null> {
	try {
		const raw = await readFile(policyPath, "utf8");
		return PolicySchema.parse(JSON.parse(raw));
	} catch {
		return null;
	}
}

export async function loadGlobalConfig(configPath: string): Promise<Config | null> {
	try {
		const raw = await readFile(configPath, "utf8");
		return ConfigSchema.parse(JSON.parse(raw));
	} catch {
		return null;
	}
}
