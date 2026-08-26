#!/usr/bin/env bun
/**
 * Compiles the native messaging host into a standalone executable. Chrome's native messaging
 * spawns the "path" from the host manifest directly — it cannot run a .ts file via `bun run`
 * (no shell, no PATH lookup for interpreters) — so this must be a real executable.
 *
 * Usage: bun run build.ts   (outputs to apps/extension/native-host/dist/)
 */

import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ROOT = import.meta.dir;
const ENTRY = join(ROOT, "src", "main.ts");
const OUT_DIR = join(ROOT, "dist");
const exeSuffix = process.platform === "win32" ? ".exe" : "";
const OUT_FILE = join(OUT_DIR, `otoclaw-bridge${exeSuffix}`);

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

// WORKAROUND (Windows only): `bun build --compile` internally copies bun.exe into a temp
// file to embed it in the output executable, and that copy fails with ENOENT whenever any
// path involved (bun.exe's own path, the entry file's absolute path, or the outfile's
// directory) resolves through a non-ASCII path component — verified locally, this worktree
// lives under `C:\Users\ömer\...`. The fix is staging bun.exe, the entry file, and the
// output file all under a plain ASCII directory (see scripts/build-binary.ts at the repo
// root, which hits and works around the same bug for the CLI/daemon binaries).
function hasNonAscii(path: string): boolean {
	// biome-ignore lint: intentionally matching any byte outside printable ASCII
	return /[^\x00-\x7f]/.test(path);
}

function buildCacheDir(): string {
	if (process.platform !== "win32" || !hasNonAscii(ROOT)) {
		return join(tmpdir(), "otoclaw-native-host-build-cache");
	}
	const driveRoot = ROOT.slice(0, ROOT.indexOf("\\") + 1) || "C:\\";
	return join(driveRoot, ".otoclaw-native-host-build-cache");
}

const CACHE_DIR = buildCacheDir();
if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });

function resolveAsciiSafeBun(): string {
	const running = process.execPath;
	if (!hasNonAscii(running) && !hasNonAscii(CACHE_DIR)) return "bun";
	const safeName = process.platform === "win32" ? "bun.exe" : "bun";
	const safePath = join(CACHE_DIR, safeName);
	const needsCopy = !existsSync(safePath) || statSync(safePath).size !== statSync(running).size;
	if (needsCopy) {
		console.log(`[build] staging bun executable at ASCII-safe path ${safePath}`);
		copyFileSync(running, safePath);
	}
	return safePath;
}

const bunBin = resolveAsciiSafeBun();
const stagedOutfile = join(CACHE_DIR, `otoclaw-bridge${exeSuffix}`);

console.log(`[build] compiling native host -> ${OUT_FILE}`);
const result = spawnSync(bunBin, ["build", "--compile", ENTRY, "--outfile", stagedOutfile], {
	stdio: "inherit",
	cwd: ROOT,
});
if (result.error) {
	throw new Error(`[build] failed to launch bun: ${result.error.message}`);
}
if (result.status !== 0) {
	throw new Error(`[build] native host compile failed (exit ${result.status})`);
}
copyFileSync(stagedOutfile, OUT_FILE);
console.log(`[build] done -> ${OUT_FILE}`);
