import { expect, test } from "bun:test";
import type { Config, Policy } from "@otoclaw/shared";
import { resolvePolicy } from "../src/policy";

const projectPolicy: Policy = {
	shell: "ask",
	"shell.allow": ["npm *"],
	"shell.deny": ["rm -rf *"],
	"fs.write": "allow",
	"web.fetch": "deny",
};

const globalConfig: Config = {
	mode: "auto",
	permissions: {
		shell: "deny",
		"fs.write": "deny",
		"web.fetch": "allow",
		"fs.read": "allow",
	},
	sandbox: { auto: true },
};

test("resolution order matrix: session > project-policy > global-config > tool-default", () => {
	// 1. session override wins over everything else.
	const withSession = resolvePolicy({
		permissionKey: "shell",
		toolDefault: "ask",
		sessionOverrides: { shell: "always" },
		projectPolicy,
		globalConfig,
	});
	expect(withSession).toEqual({ decision: "always", source: "session" });

	// 2. no session override -> project policy wins over global config.
	const withProject = resolvePolicy({
		permissionKey: "shell",
		toolDefault: "ask",
		projectPolicy,
		globalConfig,
	});
	expect(withProject).toEqual({ decision: "ask", source: "project-policy" });

	// 3. no session, no project field for this key -> falls to global config.
	const withGlobalOnly = resolvePolicy({
		permissionKey: "fs.read",
		toolDefault: "ask",
		projectPolicy,
		globalConfig,
	});
	expect(withGlobalOnly).toEqual({ decision: "allow", source: "global-config" });

	// 4. nothing set anywhere -> tool default.
	const withDefaultOnly = resolvePolicy({
		permissionKey: "fs.read",
		toolDefault: "ask",
	});
	expect(withDefaultOnly).toEqual({ decision: "ask", source: "tool-default" });

	// 5. project policy present but missing this specific field (no policy mapping for
	//    "web.search") -> falls through project to global config.
	const withProjectMiss = resolvePolicy({
		permissionKey: "web.search",
		toolDefault: "ask",
		projectPolicy,
		globalConfig: { ...globalConfig, permissions: { "web.search": "deny" } },
	});
	expect(withProjectMiss).toEqual({ decision: "deny", source: "global-config" });
});

test("project fs.write allow overrides global fs.write deny", () => {
	const result = resolvePolicy({
		permissionKey: "fs.write",
		toolDefault: "ask",
		projectPolicy,
		globalConfig,
	});
	expect(result).toEqual({ decision: "allow", source: "project-policy" });
});
