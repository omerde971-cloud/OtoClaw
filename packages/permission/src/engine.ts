import type { Config, Policy } from "@otoclaw/shared";
import { matchDangerousCommand, matchesAnyGlob } from "./danger-matcher";
import { resolvePolicy } from "./policy";
import type { PermissionCheckResult, PermissionDecision, RiskScore, SessionOverrides } from "./types";

const BASE_RISK_BY_PERMISSION_KEY: Record<string, number> = {
	"fs.read": 5,
	"fs.write": 30,
	shell: 50,
	"web.fetch": 20,
	mcp: 40,
	browser: 45,
	vision: 15,
};

function baseRisk(permissionKey: string): number {
	return BASE_RISK_BY_PERMISSION_KEY[permissionKey] ?? 25;
}

export interface PermissionCheckInput {
	toolName: string;
	permissionKey: string;
	/** Shell command text, required to evaluate danger patterns / allow-deny globs for `shell`. */
	cmd?: string;
	mode: "manual" | "auto";
	toolDefault: PermissionDecision;
	sessionOverrides?: SessionOverrides;
	projectPolicy?: Policy | null;
	globalConfig?: Config | null;
}

export class PermissionEngine {
	check(input: PermissionCheckInput): PermissionCheckResult {
		if (input.mode === "manual") {
			return {
				decision: "ask",
				risk: { score: baseRisk(input.permissionKey), reasons: ["manual mode always asks"] },
				escalate: false,
				sandboxRequired: false,
			};
		}

		// mode === "auto" from here on. Sandbox is a hard invariant — always required,
		// never toggled off by config.sandbox.auto or any policy value.
		const sandboxRequired = true;

		if (input.permissionKey === "shell" && input.cmd !== undefined) {
			const danger = matchDangerousCommand(input.cmd);
			if (danger.dangerous) {
				return {
					decision: "ask",
					risk: { score: 95, reasons: [danger.reason ?? "matched a hard-blocked danger pattern"] },
					escalate: true,
					sandboxRequired,
					reason: danger.reason,
				};
			}

			const denyList = input.projectPolicy?.["shell.deny"] ?? [];
			if (matchesAnyGlob(denyList, input.cmd)) {
				return {
					decision: "deny",
					risk: { score: 70, reasons: ["matched shell.deny"] },
					escalate: false,
					sandboxRequired,
					reason: "matched shell.deny",
				};
			}

			const allowList = input.projectPolicy?.["shell.allow"] ?? [];
			if (matchesAnyGlob(allowList, input.cmd)) {
				return {
					decision: "allow",
					risk: { score: 10, reasons: ["matched shell.allow"] },
					escalate: false,
					sandboxRequired,
				};
			}
		}

		const resolution = resolvePolicy({
			permissionKey: input.permissionKey,
			toolDefault: input.toolDefault,
			sessionOverrides: input.sessionOverrides,
			projectPolicy: input.projectPolicy,
			globalConfig: input.globalConfig,
		});

		const risk: RiskScore = {
			score: baseRisk(input.permissionKey),
			reasons: [`resolved via ${resolution.source}`],
		};

		return {
			decision: resolution.decision,
			risk,
			escalate: false,
			sandboxRequired,
		};
	}
}
