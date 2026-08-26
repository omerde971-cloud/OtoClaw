import type { PermissionDecisionValue } from "@otoclaw/shared";

export type PermissionDecision = PermissionDecisionValue;

export interface RiskScore {
	/** 0 (harmless) .. 100 (destructive/exfiltration-grade). */
	score: number;
	reasons: string[];
}

export interface PolicyResolution {
	decision: PermissionDecision;
	/** Where the decision came from, for UI/debug purposes. */
	source: "session" | "project-policy" | "global-config" | "tool-default";
}

export interface SessionOverrides {
	/** tool name or permission key -> decision, learned via "always"/"never" from a prior prompt. */
	[key: string]: PermissionDecision;
}

export interface PermissionCheckResult {
	decision: PermissionDecision;
	risk: RiskScore;
	/** True when Auto mode must still surface a button question despite an allow/ask policy. */
	escalate: boolean;
	/**
	 * Auto mode always requires process-level sandboxing (cwd jail, env scrub,
	 * danger-matcher, mandatory timeout) — this is never false when mode === "auto",
	 * regardless of any config.sandbox.auto value. See ARCHITECTURE.md §8/§18.
	 */
	sandboxRequired: boolean;
	reason?: string;
}
