import { expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scrubEnv, shellRun } from "../src/shell";
import type { ToolContext } from "../src/types";

function makeCtx(): ToolContext {
	const dir = mkdtempSync(join(tmpdir(), "otoclaw-shell-"));
	return { cwd: dir, sessionId: randomUUID() };
}

test("shell.run captures stdout and a zero exit code", async () => {
	const ctx = makeCtx();
	const result = await shellRun.run({ cmd: "echo hello-otoclaw", timeout: 5000 }, ctx);
	expect(result.ok).toBe(true);
	expect(result.value?.stdout).toContain("hello-otoclaw");
	expect(result.value?.exitCode).toBe(0);
	expect(result.value?.timedOut).toBe(false);
	rmSync(ctx.cwd, { recursive: true, force: true });
});

test("shell.run surfaces a non-zero exit code as not-ok", async () => {
	const ctx = makeCtx();
	const cmd = process.platform === "win32" ? "exit /b 3" : "exit 3";
	const result = await shellRun.run({ cmd, timeout: 5000 }, ctx);
	expect(result.ok).toBe(false);
	expect(result.value?.exitCode).toBe(3);
	rmSync(ctx.cwd, { recursive: true, force: true });
});

test("shell.run enforces the timeout", async () => {
	const ctx = makeCtx();
	const cmd = process.platform === "win32" ? "ping -n 20 127.0.0.1 >NUL" : "sleep 20";
	const result = await shellRun.run({ cmd, timeout: 300 }, ctx);
	expect(result.ok).toBe(false);
	expect(result.value?.timedOut).toBe(true);
	expect(result.error).toContain("timed out");
	// Best-effort: on Windows a killed cmd.exe can leave its grandchild (ping.exe)
	// briefly holding the cwd open, so tolerate a transient EBUSY here.
	try {
		rmSync(ctx.cwd, { recursive: true, force: true });
	} catch {
		// cleaned up by the OS temp-dir janitor eventually
	}
}, 10000);

test("shell.run rejects a cwd override that escapes the session jail", async () => {
	const ctx = makeCtx();
	const result = await shellRun.run({ cmd: "echo hi", cwd: "../../", timeout: 5000 }, ctx);
	expect(result.ok).toBe(false);
	expect(result.error).toContain("jail");
	rmSync(ctx.cwd, { recursive: true, force: true });
});

test("scrubEnv only passes through whitelisted variables", () => {
	const scrubbed = scrubEnv({ PATH: "/usr/bin", SECRET_TOKEN: "leak-me", USERPROFILE: "C:\\Users\\x" });
	expect(scrubbed.PATH).toBe("/usr/bin");
	expect(scrubbed.SECRET_TOKEN).toBeUndefined();
});
