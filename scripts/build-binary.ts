#!/usr/bin/env bun
/**
 * Builds standalone otoclaw executables with `bun build --compile`.
 *
 * Usage:
 *   bun run scripts/build-binary.ts                       # compile for the host platform
 *   bun run scripts/build-binary.ts --target=bun-linux-x64 # cross-compile
 *   BUILD_TARGET=bun-darwin-arm64 bun run scripts/build-binary.ts
 *
 * Output goes to packages/cli/dist/, matching the "bin" entry in packages/cli/package.json.
 *
 * ---------------------------------------------------------------------------
 * DESIGN DECISION — two binaries instead of one self-spawning binary
 * ---------------------------------------------------------------------------
 * packages/cli/src/index.tsx currently starts the daemon like this (see spawnDaemon()):
 *
 *   Bun.spawn(["bun", "run", join(import.meta.dir, "..", "..", "daemon", "src", "main.ts")])
 *
 * i.e. it shells out to a `bun` on PATH and re-reads the daemon's TypeScript source. That
 * only works in a dev checkout. Two ways to make this work from a compiled binary were
 * considered:
 *
 *   (a) Single binary: compile only the CLI, and teach index.tsx to recognize a hidden
 *       `--daemon` flag, re-exec'ing itself (`Bun.spawn([process.execPath, "--daemon"])`)
 *       to run the daemon in-process-as-child. Smaller artifact, one binary to ship.
 *   (b) Two binaries: compile the CLI entry (index.tsx) and the daemon entry (main.ts)
 *       into separate standalone executables (`otoclaw`, `otoclaw-daemon`) that ship
 *       side by side, and have the CLI spawn the sibling `otoclaw-daemon` executable.
 *
 * (a) is the smaller/slicker end state, but it requires editing the dispatch logic at the
 * top of packages/cli/src/index.tsx (and packages/daemon's entrypoint would need to become
 * an importable function rather than a top-level side-effecting script). This phase (6b)
 * is scoped to scripts/** and package.json only — packages/cli/src/*.tsx is explicitly
 * off-limits. (b) requires zero source changes: `bun build --compile` happily takes any
 * entrypoint file, so we just point it at the daemon's main.ts too. It also composes
 * cleanly with a later phase that *does* touch index.tsx: swapping spawnDaemon()'s
 * `Bun.spawn(["bun", "run", <src path>])` for `Bun.spawn([daemonBinaryPath])` (resolved
 * next to process.execPath, or on PATH) is a small, self-contained follow-up — not a
 * rework of this build script. So (b) is chosen here as the simplest option that is fully
 * buildable within this task's scope.
 *
 * KNOWN LIMITATION (tracked for a later phase, not fixed here): today, running the
 * compiled `otoclaw` binary still tries to spawn the daemon via `bun run <source path>`,
 * which won't exist in an installed distribution. That's an index.tsx change and is out
 * of scope for 6b (install scripts). This build script only produces the two binaries;
 * wiring the CLI's daemon-spawn logic to find `otoclaw-daemon` is future work.
 * ---------------------------------------------------------------------------
 */

import { spawn, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..");
// Passed to bun as paths relative to `cwd: ROOT` (see compile()) rather than absolute —
// keeps the entry argument itself ASCII even when ROOT contains non-ASCII characters
// (see the ENOENT workaround below).
const CLI_ENTRY = join("packages", "cli", "src", "index.tsx");
const DAEMON_ENTRY = join("packages", "daemon", "src", "main.ts");
const OUT_DIR = join(ROOT, "packages", "cli", "dist");

const BUN_TARGETS = [
	"bun-windows-x64",
	"bun-linux-x64",
	"bun-linux-x64-baseline",
	"bun-linux-arm64",
	"bun-darwin-x64",
	"bun-darwin-arm64",
] as const;
type BunTarget = (typeof BUN_TARGETS)[number];

function currentTarget(): BunTarget {
	const { platform, arch } = process;
	if (platform === "win32") return "bun-windows-x64";
	if (platform === "darwin") return arch === "arm64" ? "bun-darwin-arm64" : "bun-darwin-x64";
	if (platform === "linux") return arch === "arm64" ? "bun-linux-arm64" : "bun-linux-x64";
	throw new Error(`[build-binary] unsupported host platform: ${platform}`);
}

function parseTarget(): BunTarget {
	const argTarget = process.argv
		.slice(2)
		.find((a) => a.startsWith("--target="))
		?.split("=")[1];
	const raw = argTarget ?? process.env.BUILD_TARGET;
	if (!raw) return currentTarget();
	if (!(BUN_TARGETS as readonly string[]).includes(raw)) {
		throw new Error(
			`[build-binary] unknown --target "${raw}". Expected one of: ${BUN_TARGETS.join(", ")}`,
		);
	}
	return raw as BunTarget;
}

const target = parseTarget();
const host = currentTarget();
const isHostTarget = target === host;
const exeSuffix = target.startsWith("bun-windows") ? ".exe" : "";

if (!existsSync(OUT_DIR)) {
	mkdirSync(OUT_DIR, { recursive: true });
}

// WORKAROUND (Windows only): `bun build --compile` internally self-copies the running
// bun.exe into a temp file to embed it in the output executable, and that internal copy
// fails with "ENOENT" whenever *any* path involved — bun.exe's own path, the entry file's
// absolute path, or the --outfile's directory — resolves through a non-ASCII path
// component. Verified locally: this repo's worktree lives under `C:\Users\ömer\...`.
// Windows' 8.3 short-name aliasing (e.g. `MER~1`) does NOT avoid the bug either — even
// %TEMP%, which is itself nested under the non-ASCII profile dir, still triggers it. The
// only reliable workaround found is staging bun.exe, the entry file, and the output file
// all under a plain ASCII directory at the drive root, outside the user profile entirely.
// This is a no-op on hosts whose paths are already ASCII-only (Linux/macOS CI, etc.).
function hasNonAscii(path: string): boolean {
	// biome-ignore lint: intentionally matching any byte outside printable ASCII
	return /[^\x00-\x7f]/.test(path);
}

function buildCacheDir(): string {
	if (process.platform !== "win32" || !hasNonAscii(ROOT)) {
		return join(tmpdir(), "otoclaw-build-cache");
	}
	const driveRoot = ROOT.slice(0, ROOT.indexOf("\\") + 1) || "C:\\";
	return join(driveRoot, ".otoclaw-build-cache");
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
		console.log(`[build-binary] staging bun executable at ASCII-safe path ${safePath}`);
		console.log("[build-binary] (works around a bun --compile ENOENT bug on Windows with non-ASCII paths)");
		copyFileSync(running, safePath);
	}
	return safePath;
}

const bunBin = resolveAsciiSafeBun();

// Cross-compiling (target !== host) hits the same non-ASCII-path ENOENT bug a second way:
// bun auto-downloads the target platform's base executable into
// `~/.bun/install/cache/<target>-v<bunVersion>` before embedding it, and that cache lives
// under the (possibly non-ASCII) home directory regardless of CACHE_DIR. `bun build
// --compile` accepts `--compile-executable-path=<file>` to supply that base executable
// explicitly instead of downloading+copying it internally. So: try the plain compile
// first (its failure still leaves the target executable downloaded into cache as a side
// effect), then on failure locate that cached file, stage an ASCII copy of it in
// CACHE_DIR, and retry once with --compile-executable-path pointing at the ASCII copy.
function findCachedTargetExecutable(): string | null {
	const bunCacheDir = join(homedir(), ".bun", "install", "cache");
	if (!existsSync(bunCacheDir)) return null;
	const bunVersion = process.versions.bun ?? "";
	const candidates = [`${target}-v${bunVersion}`, target];
	for (const name of candidates) {
		const candidate = join(bunCacheDir, name);
		if (existsSync(candidate)) return candidate;
	}
	return null;
}

function stageAsciiTargetExecutable(): string | null {
	const cached = findCachedTargetExecutable();
	if (!cached) return null;
	const staged = join(CACHE_DIR, `target-${target}`);
	if (!existsSync(staged) || statSync(staged).size !== statSync(cached).size) {
		copyFileSync(cached, staged);
	}
	return staged;
}

function compile(entry: string, outfile: string, label: string): void {
	// Stage the entry file's source tree isn't practical (it has relative imports across
	// the monorepo), but staging just the *entry path argument* and --outfile under
	// CACHE_DIR is enough: cwd may stay unicode, only the two path arguments bun.exe
	// touches directly for the compile step need to be ASCII.
	const stagedOutfile = join(CACHE_DIR, `${label}${exeSuffix}`);
	console.log(`[build-binary] compiling ${label} (target=${target}) -> ${outfile}`);
	// chromium-bidi/*: playwright-core's optional BiDi driver (pulled in indirectly via
	// @otoclaw/mcp's browser tooling, daemon only) isn't installed and isn't needed —
	// otoclaw only drives Chrome over CDP. `bun build --compile` still eagerly tries to
	// resolve it unless told not to. (ink's react-devtools-core needed the opposite fix:
	// it's now a real dependency — see packages/cli/package.json — instead of an
	// --external, because marking it external let it build but then crashed at *runtime*
	// with "Cannot find package 'react-devtools-core'": dynamic import() expressions are
	// still eagerly evaluated by the compiled binary even inside an unreachable
	// `if (process.env.DEV === 'true')` branch, since it's never DEV in a released
	// binary. Installing the real (small) package means the import always resolves.)
	const baseArgs = ["build", "--compile", "--external=chromium-bidi/*", `--target=${target}`];
	function runCompile(extraArgs: string[]): ReturnType<typeof spawnSync> {
		return spawnSync(bunBin, [...baseArgs, ...extraArgs, entry, "--outfile", stagedOutfile], {
			stdio: "inherit",
			cwd: ROOT,
		});
	}

	let result = runCompile([]);
	if (result.status !== 0 && !isHostTarget) {
		const stagedTargetExe = stageAsciiTargetExecutable();
		if (stagedTargetExe) {
			console.log(
				`[build-binary] retrying ${label} compile with --compile-executable-path=${stagedTargetExe}`,
			);
			result = runCompile([`--compile-executable-path=${stagedTargetExe}`]);
		}
	}
	if (result.error) {
		throw new Error(`[build-binary] failed to launch bun for ${label}: ${result.error.message}`);
	}
	if (result.status !== 0) {
		throw new Error(`[build-binary] ${label} compile failed (exit ${result.status})`);
	}
	copyFileSync(stagedOutfile, outfile);
}

const cliOut = join(OUT_DIR, `otoclaw${exeSuffix}`);
const daemonOut = join(OUT_DIR, `otoclaw-daemon${exeSuffix}`);

compile(CLI_ENTRY, cliOut, "cli");
compile(DAEMON_ENTRY, daemonOut, "daemon");

if (!isHostTarget) {
	console.log(
		`[build-binary] target ${target} differs from host ${host} — cross-compiled binaries cannot be executed here.`,
	);
	console.log("[build-binary] compile-only check passed (no smoke test for cross targets).");
	process.exit(0);
}

// ---------------------------------------------------------------------------
// Smoke tests (host target only)
// ---------------------------------------------------------------------------
// The CLI has no --version/--help flag today (adding one means editing
// packages/cli/src/index.tsx or App.tsx, both out of scope for this task). Instead we run
// each compiled binary briefly and check it produces the output we expect from its real
// startup path, rather than a binary-corruption / "module not found" failure. That's still
// a genuine smoke test of the compiled artifact: it proves Bun's runtime is embedded
// correctly and the bundled JS actually executes.

function runWithTimeout(
	bin: string,
	args: string[],
	timeoutMs: number,
): Promise<{ stdout: string; stderr: string; timedOut: boolean; code: number | null }> {
	return new Promise((resolve, reject) => {
		const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
		let stdout = "";
		let stderr = "";
		let timedOut = false;
		const timer = setTimeout(() => {
			timedOut = true;
			child.kill();
		}, timeoutMs);
		child.stdout.on("data", (d) => {
			stdout += d.toString();
		});
		child.stderr.on("data", (d) => {
			stderr += d.toString();
		});
		child.on("error", (err) => {
			clearTimeout(timer);
			reject(err);
		});
		child.on("close", (code) => {
			clearTimeout(timer);
			resolve({ stdout, stderr, timedOut, code });
		});
	});
}

async function smokeTestDaemon(): Promise<void> {
	console.log("[build-binary] smoke-testing otoclaw-daemon binary...");
	const result = await runWithTimeout(daemonOut, [], 6000);
	const output = result.stdout + result.stderr;
	if (!output.includes("otoclaw daemon listening on ws://")) {
		throw new Error(
			`[build-binary] daemon smoke test FAILED — expected startup log not seen.\n--- output ---\n${output}`,
		);
	}
	console.log("[build-binary] otoclaw-daemon smoke test OK (daemon started and logged listening address)");
}

async function smokeTestCli(): Promise<void> {
	console.log("[build-binary] smoke-testing otoclaw binary...");
	// No daemon is running and no daemon.json exists for this ephemeral run, so the CLI
	// will try to spawn one and, in this compiled artifact, fail to find the daemon
	// source (see KNOWN LIMITATION above) and time out after 5s with a clear error. That
	// bounded, well-formed failure — as opposed to a crash or hang — is what we assert on.
	const result = await runWithTimeout(cliOut, [], 8000);
	const output = result.stdout + result.stderr;
	const ranCleanly =
		output.includes("otoclaw daemon did not start in time") ||
		output.includes("failed to connect to the otoclaw daemon") ||
		// happens instead of the above when "bun" isn't on PATH at all (spawnDaemon()
		// shells out to it) — still a clean, expected failure, not a corrupt binary.
		output.includes('Executable not found in $PATH: "bun"');
	if (!ranCleanly && !result.timedOut) {
		throw new Error(
			`[build-binary] cli smoke test FAILED — unexpected exit.\n--- output ---\n${output}`,
		);
	}
	console.log("[build-binary] otoclaw smoke test OK (binary executed and ran its startup path)");
}

await smokeTestDaemon();
await smokeTestCli();

console.log(`[build-binary] done. Binaries written to ${OUT_DIR}`);
