import { afterAll, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DaemonRuntimeInfoSchema } from "@otoclaw/shared";

/**
 * "Submit and forget" only holds if the daemon truly outlives the CLI process that
 * launched it — this exercises real OS processes (not the in-process startServer() used by
 * the other daemon tests) to prove that. A "fake CLI" process spawns the real daemon entry
 * point exactly the way packages/cli/src/index.tsx's spawnDaemon() does (Bun.spawn with
 * ignored stdio + unref()), then is killed outright. If unref() weren't wired up, either
 * Bun would keep the fake-CLI process alive waiting on the daemon (so it would never exit
 * on its own) or — depending on platform process-group semantics — killing the fake-CLI
 * process could take the daemon down with it. Slower than the other daemon tests (spawns
 * two real Bun processes, `bun run`ning TS sources) so it gets a generous timeout.
 */

function waitFor<T>(check: () => T | undefined, timeoutMs = 15000, intervalMs = 100): Promise<T> {
	const start = Date.now();
	return new Promise((resolve, reject) => {
		const tick = () => {
			const value = check();
			if (value !== undefined) {
				resolve(value);
				return;
			}
			if (Date.now() - start > timeoutMs) {
				reject(new Error(`waitFor timed out after ${timeoutMs}ms`));
				return;
			}
			setTimeout(tick, intervalMs);
		};
		tick();
	});
}

/**
 * Deliberately NOT `taskkill /T` on Windows: /T kills the whole process tree, which would
 * also kill the daemon — Windows still records the daemon's "parent process id" as the
 * fake-CLI's pid (unref() only tells *Bun's own event loop* not to wait on the child; it
 * doesn't change that OS-level bookkeeping). Killing only the exact pid is what actually
 * tests whether the daemon is independent of its spawning process.
 */
function killPid(pid: number): void {
	try {
		if (process.platform === "win32") {
			Bun.spawnSync(["taskkill", "/F", "/PID", String(pid)]);
		} else {
			process.kill(pid, "SIGTERM");
		}
	} catch {
		// already gone
	}
}

const cleanupFns: Array<() => void> = [];
afterAll(() => {
	for (const fn of cleanupFns.splice(0)) {
		try {
			fn();
		} catch {
			// best-effort cleanup
		}
	}
});

test(
	"daemon survives the CLI process that spawned it being killed",
	async () => {
		const tempHome = mkdtempSync(join(tmpdir(), "otoclaw-persistence-home-"));
		cleanupFns.push(() => rmSync(tempHome, { recursive: true, force: true }));

		const daemonEntry = join(import.meta.dir, "..", "src", "main.ts");
		const fakeCliEntry = join(import.meta.dir, "support", "fake-cli.ts");
		expect(existsSync(daemonEntry)).toBe(true);
		expect(existsSync(fakeCliEntry)).toBe(true);

		// Isolate this test's daemon.json/sessions.db under tempHome (~/.otoclaw resolves off
		// HOME/USERPROFILE) so it can't collide with a real daemon.json on this machine or with
		// the other daemon tests' in-process servers.
		const childEnv = {
			...process.env,
			HOME: tempHome,
			USERPROFILE: tempHome,
			OTOCLAW_TEST_DAEMON_ENTRY: daemonEntry,
		};

		const fakeCli = Bun.spawn(["bun", "run", fakeCliEntry], {
			env: childEnv,
			stdout: "ignore",
			stderr: "ignore",
			stdin: "ignore",
		});

		// The fake-CLI process spawns the daemon and unref()s it almost immediately — give it
		// a brief moment to do that, then kill it outright (simulating a closed terminal
		// window / Ctrl+C), well before we know whether the daemon has finished starting up.
		await new Promise((resolve) => setTimeout(resolve, 300));
		killPid(fakeCli.pid);
		const fakeCliExitCode = await fakeCli.exited;
		expect(fakeCliExitCode).not.toBeNull();

		const daemonJsonPath = join(tempHome, ".otoclaw", "daemon.json");
		const runtimeInfo = await waitFor(() => {
			if (!existsSync(daemonJsonPath)) return undefined;
			try {
				return DaemonRuntimeInfoSchema.parse(JSON.parse(readFileSync(daemonJsonPath, "utf8")));
			} catch {
				return undefined;
			}
		});
		cleanupFns.push(() => killPid(runtimeInfo.pid));

		// The daemon's pid must differ from (and outlive) the fake-CLI's — proof this is a
		// genuinely detached grandchild process, not something still tethered to its parent.
		expect(runtimeInfo.pid).not.toBe(fakeCli.pid);

		// Daemon is up and actually accepting connections, well after its spawning "CLI"
		// process is gone.
		const ws = new WebSocket(`ws://127.0.0.1:${runtimeInfo.port}/ws?token=${runtimeInfo.token}`);
		cleanupFns.push(() => {
			try {
				ws.close();
			} catch {
				// already closed
			}
		});
		await new Promise<void>((resolve, reject) => {
			ws.onopen = () => resolve();
			ws.onerror = () => reject(new Error("ws failed to open against the detached daemon"));
		});

		const messages: unknown[] = [];
		ws.onmessage = (ev) => messages.push(JSON.parse(ev.data as string));
		ws.send(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "session.create", params: { cwd: ".", mode: "manual" } }));
		const sessionResponse = (await waitFor(() =>
			messages.find((m): m is { id: number; result?: { sessionId?: string } } => typeof m === "object" && m !== null && (m as { id?: unknown }).id === 1),
			5000,
		)) as { result?: { sessionId?: string } };
		expect(typeof sessionResponse.result?.sessionId).toBe("string");

		ws.close();
		killPid(runtimeInfo.pid);
		await waitFor(() => (existsSync(daemonJsonPath) ? undefined : true), 5000).catch(() => {
			// best-effort: forced kill doesn't run the graceful SIGTERM handler that deletes
			// daemon.json on every platform; tempHome cleanup below removes it regardless.
		});
	},
	30000,
);
