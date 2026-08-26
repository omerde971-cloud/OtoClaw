/** Converts a simple `*`-wildcard glob into a case-insensitive whole-string matcher. */
export function globToRegExp(pattern: string): RegExp {
	const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
	return new RegExp(`^${escaped}$`, "i");
}

export function globMatch(pattern: string, input: string): boolean {
	return globToRegExp(pattern).test(input.trim());
}

export function matchesAnyGlob(patterns: string[], input: string): boolean {
	return patterns.some((pattern) => globMatch(pattern, input));
}

interface DangerPattern {
	regex: RegExp;
	reason: string;
}

// Hard-blocked even in Auto mode. See ARCHITECTURE.md §8/§18.
const DANGER_PATTERNS: DangerPattern[] = [
	{ regex: /\brm\s+(-\w*r\w*f\w*|-\w*f\w*r\w*)\b/i, reason: "recursive force delete (rm -rf)" },
	{ regex: /\|\s*sh\b/i, reason: "pipes into a shell (| sh)" },
	{ regex: /\|\s*bash\b/i, reason: "pipes into a shell (| bash)" },
	{ regex: /\bcurl\b[^\n]*\|/i, reason: "curl output piped into a command" },
	{ regex: /\bwget\b[^\n]*\|/i, reason: "wget output piped into a command" },
	{ regex: /\bsudo\b/i, reason: "privilege escalation (sudo)" },
	{ regex: /\bformat\s+[a-z]:/i, reason: "disk format" },
	{ regex: /\bmkfs(\.\w+)?\b/i, reason: "filesystem format (mkfs)" },
	{ regex: /\bdd\s+if=/i, reason: "raw disk write (dd if=)" },
	{ regex: /\bdel\s+\/[sf]/i, reason: "recursive/force delete (del /s or /f)" },
	{ regex: /\brmdir\s+\/s\b/i, reason: "recursive directory delete (rmdir /s)" },
	{ regex: /\bshutdown\b/i, reason: "system shutdown/restart" },
];

export interface DangerMatchResult {
	dangerous: boolean;
	reason?: string;
}

export function matchDangerousCommand(cmd: string): DangerMatchResult {
	for (const pattern of DANGER_PATTERNS) {
		if (pattern.regex.test(cmd)) {
			return { dangerous: true, reason: pattern.reason };
		}
	}
	return { dangerous: false };
}
