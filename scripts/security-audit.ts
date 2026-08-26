#!/usr/bin/env bun
/**
 * Informational security audit for the OtoClaw monorepo. Four best-effort checks:
 *
 *   1. plaintext secret leakage — console.log/console.error lines that mention a
 *      secret-shaped variable name without an obvious redaction marker
 *   2. .gitignore coverage — the paths ARCHITECTURE.md §18/§4 assume are ignored
 *   3. permission risk invariant — `bun test packages/permission` still passes
 *      (sandboxRequired:true in Auto mode is covered by that suite, not re-checked here)
 *   4. dependency license scan — package names that look like copyleft (GPL/AGPL) packages
 *
 * This script is informational only: it never calls process.exit(1) and must never fail CI.
 * Findings are heuristics, not proof — every section says so.
 */

import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(import.meta.dir, "..");

function walk(dir: string, exts: string[], skipDirs: Set<string>): string[] {
	const out: string[] = [];
	let entries: string[];
	try {
		entries = readdirSync(dir);
	} catch {
		return out;
	}
	for (const entry of entries) {
		if (skipDirs.has(entry)) continue;
		const full = join(dir, entry);
		const st = statSync(full);
		if (st.isDirectory()) {
			out.push(...walk(full, exts, skipDirs));
		} else if (exts.some((ext) => entry.endsWith(ext))) {
			out.push(full);
		}
	}
	return out;
}

const SKIP_DIRS = new Set(["node_modules", ".bun", "dist", "build", ".git"]);

// ---------------------------------------------------------------------------
// Check 1 — plaintext secret leakage in console.log/console.error calls
// ---------------------------------------------------------------------------

interface SecretLeakFinding {
	file: string;
	line: number;
	text: string;
}

function checkSecretLeaks(): SecretLeakFinding[] {
	const findings: SecretLeakFinding[] = [];
	const files = [
		...walk(join(ROOT, "packages"), [".ts", ".tsx"], SKIP_DIRS),
		...walk(join(ROOT, "apps"), [".ts", ".tsx"], SKIP_DIRS),
	].filter((f) => !f.endsWith(".test.ts") && !f.endsWith(".test.tsx"));

	const secretName = /\b(api[_-]?key|token|password|secret)\b/i;
	const consoleCall = /console\.(log|error|warn|info|debug)\s*\(/;
	const redactionHint = /(redact|mask|\*{3,}|\.\.\.\s*\)|\[hidden\]|\[redacted\])/i;

	for (const file of files) {
		let content: string;
		try {
			content = readFileSync(file, "utf8");
		} catch {
			continue;
		}
		const lines = content.split("\n");
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			if (!consoleCall.test(line)) continue;
			if (!secretName.test(line)) continue;
			if (redactionHint.test(line)) continue;
			findings.push({ file: relative(ROOT, file), line: i + 1, text: line.trim() });
		}
	}
	return findings;
}

// ---------------------------------------------------------------------------
// Check 2 — .gitignore coverage
// ---------------------------------------------------------------------------

function checkGitignore(): { present: string[]; missing: string[] } {
	const required = ["node_modules/", ".otoclaw/", "dist/", "build/", "*.log"];
	let content = "";
	try {
		content = readFileSync(join(ROOT, ".gitignore"), "utf8");
	} catch {
		return { present: [], missing: required };
	}
	const lines = content
		.split("\n")
		.map((l) => l.trim())
		.filter(Boolean);
	const present: string[] = [];
	const missing: string[] = [];
	for (const pattern of required) {
		if (lines.includes(pattern)) present.push(pattern);
		else missing.push(pattern);
	}
	return { present, missing };
}

// ---------------------------------------------------------------------------
// Check 3 — permission risk invariant test coverage
// ---------------------------------------------------------------------------

interface PermissionCheckResult {
	testFileExists: boolean;
	testRan: boolean;
	passed: boolean;
	summary: string;
}

function checkPermissionInvariant(): PermissionCheckResult {
	const testFile = join(ROOT, "packages", "permission", "test", "engine.test.ts");
	let testFileExists = true;
	try {
		statSync(testFile);
	} catch {
		testFileExists = false;
	}

	if (!testFileExists) {
		return {
			testFileExists: false,
			testRan: false,
			passed: false,
			summary: "packages/permission/test/engine.test.ts not found",
		};
	}

	const result = spawnSync("bun", ["test", "packages/permission"], {
		cwd: ROOT,
		encoding: "utf8",
	});
	const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
	const passed = result.status === 0;
	return {
		testFileExists: true,
		testRan: true,
		passed,
		summary: passed
			? "bun test packages/permission passed (sandboxRequired:true invariant in Auto mode is exercised there)"
			: `bun test packages/permission FAILED (exit ${result.status}):\n${output.slice(-2000)}`,
	};
}

// ---------------------------------------------------------------------------
// Check 4 — dependency license scan (best-effort)
// ---------------------------------------------------------------------------

interface LicenseFinding {
	packageJson: string;
	dependency: string;
	version: string;
}

function checkDependencyLicenses(): LicenseFinding[] {
	const findings: LicenseFinding[] = [];
	const copyleftPattern = /(^|[^a-z])(a?gpl)([^a-z]|$)/i;

	const packageJsonFiles = [
		join(ROOT, "package.json"),
		...walk(join(ROOT, "packages"), [".json"], SKIP_DIRS).filter((f) => f.endsWith("package.json")),
		...walk(join(ROOT, "apps"), [".json"], SKIP_DIRS).filter((f) => f.endsWith("package.json")),
	];

	for (const file of packageJsonFiles) {
		let pkg: Record<string, unknown>;
		try {
			pkg = JSON.parse(readFileSync(file, "utf8"));
		} catch {
			continue;
		}
		const depGroups = ["dependencies", "devDependencies", "peerDependencies"];
		for (const group of depGroups) {
			const deps = pkg[group] as Record<string, string> | undefined;
			if (!deps) continue;
			for (const [name, version] of Object.entries(deps)) {
				if (copyleftPattern.test(name)) {
					findings.push({ packageJson: relative(ROOT, file), dependency: name, version });
				}
			}
		}
	}
	return findings;
}

// ---------------------------------------------------------------------------
// Run + report
// ---------------------------------------------------------------------------

const secretLeaks = checkSecretLeaks();
const gitignore = checkGitignore();
const permission = checkPermissionInvariant();
const licenseFindings = checkDependencyLicenses();

const report = {
	check1_plaintextSecretScan: {
		description:
			"console.log/error lines mentioning a secret-shaped name without an obvious redaction marker. Heuristic only — findings may be false positives (e.g. a variable literally named 'token' that holds a non-secret ID).",
		findingCount: secretLeaks.length,
		findings: secretLeaks,
	},
	check2_gitignoreCoverage: {
		description: "Required ignore patterns per ARCHITECTURE.md §4/§18.",
		present: gitignore.present,
		missing: gitignore.missing,
	},
	check3_permissionRiskInvariant: {
		description:
			"Confirms packages/permission/test/engine.test.ts exists and passes; does not rewrite or add tests.",
		...permission,
	},
	check4_dependencyLicenseScan: {
		description:
			"Best-effort scan of package.json dependency names for GPL/AGPL patterns. Not a real license resolution (does not read installed package LICENSE files) — a package name matching this pattern is not proof of a copyleft license, and a differently-named copyleft package would be missed entirely.",
		findingCount: licenseFindings.length,
		findings: licenseFindings,
	},
};

console.log("=== OtoClaw security audit (informational — never fails CI) ===\n");
console.log(JSON.stringify(report, null, 2));

console.log("\n=== Summary ===");
console.log(`Check 1 (plaintext secret scan):    ${secretLeaks.length} finding(s)`);
console.log(
	`Check 2 (.gitignore coverage):      ${gitignore.missing.length === 0 ? "OK — all required patterns present" : `${gitignore.missing.length} missing pattern(s): ${gitignore.missing.join(", ")}`}`,
);
console.log(
	`Check 3 (permission risk invariant): ${permission.testFileExists ? (permission.passed ? "PASSED" : "FAILED") : "test file missing"}`,
);
console.log(`Check 4 (dependency license scan):  ${licenseFindings.length} suspicious dependency name(s)`);
console.log("\nThis script is informational only and does not fail the build.");
