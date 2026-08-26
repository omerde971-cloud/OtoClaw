import type { Tool, ToolResult } from "./types";
import { resolveWithinCwd } from "./fs";

export const DEFAULT_SHELL_TIMEOUT_MS = 120_000;

/** Env vars allowed to pass through into a sandboxed shell.run process. */
const ENV_WHITELIST = ["PATH", "TEMP", "TMP", "USERPROFILE", "HOME", "SHELL", "LANG", "SYSTEMROOT"];

/** Grace period to keep draining stdout/stderr after a kill, so a killed grandchild
 * process holding the pipe open on Windows can't hang the read forever. */
const KILL_DRAIN_GRACE_MS = 1000;

export function scrubEnv(source: NodeJS.ProcessEnv): Record<string, string> {
	const scrubbed: Record<string, string> = {};
	for (const key of ENV_WHITELIST) {
		const value = source[key];
		if (value !== undefined) scrubbed[key] = value;
	}
	return scrubbed;
}

/** Reads a stream until EOF or an absolute deadline, whichever comes first. */
async function readUntilDeadline(stream: ReadableStream<Uint8Array>, deadlineAt: number): Promise<string> {
	const reader = stream.getReader();
	const decoder = new TextDecoder();
	let result = "";
	try {
		while (true) {
			const remaining = deadlineAt - Date.now();
			if (remaining <= 0) break;
			let timer: ReturnType<typeof setTimeout> | undefined;
			const timedChunk = await Promise.race([
				reader.read(),
				new Promise<{ done: true; value: undefined }>((resolve) => {
					timer = setTimeout(() => resolve({ done: true, value: undefined }), remaining);
				}),
			]);
			if (timer) clearTimeout(timer);
			if (timedChunk.done) break;
			result += decoder.decode(timedChunk.value, { stream: true });
		}
	} finally {
		try {
			reader.releaseLock();
		} catch {
			// stream already closed/errored
		}
	}
	return result;
}

interface ShellRunArgs {
	cmd: string;
	cwd?: string;
	timeout?: number;
}

interface ShellRunValue {
	stdout: string;
	stderr: string;
	exitCode: number;
	timedOut: boolean;
}

export const shellRun: Tool<ShellRunArgs, ShellRunValue> = {
	name: "shell.run",
	description: "Run a shell command, jailed to the session cwd with scrubbed env and a timeout.",
	permissionKey: "shell",
	schema: {
		type: "object",
		properties: {
			cmd: { type: "string" },
			cwd: { type: "string" },
			timeout: { type: "number" },
		},
		required: ["cmd", "timeout"],
	},
	async run(args, ctx): Promise<ToolResult<ShellRunValue>> {
		const timeout = args.timeout ?? DEFAULT_SHELL_TIMEOUT_MS;
		let cwd = ctx.cwd;
		if (args.cwd) {
			const resolved = resolveWithinCwd(ctx, args.cwd);
			if (!resolved.ok) return { ok: false, error: resolved.error };
			cwd = resolved.value as string;
		}

		const env = scrubEnv(process.env);
		const shellCmd: string[] =
			process.platform === "win32" ? ["cmd.exe", "/d", "/s", "/c", args.cmd] : ["/bin/sh", "-c", args.cmd];

		let proc: ReturnType<typeof Bun.spawn>;
		try {
			proc = Bun.spawn({
				cmd: shellCmd,
				cwd,
				env,
				stdout: "pipe",
				stderr: "pipe",
			});
		} catch (err) {
			return { ok: false, error: err instanceof Error ? err.message : String(err) };
		}

		let timedOut = false;
		const timer = setTimeout(() => {
			timedOut = true;
			try {
				proc.kill();
			} catch {
				// already exited
			}
			// On Windows, killing cmd.exe does not kill grandchildren (e.g. ping.exe) —
			// force-kill the whole process tree so a timed-out command can't linger.
			if (process.platform === "win32") {
				try {
					Bun.spawn({ cmd: ["taskkill", "/T", "/F", "/PID", String(proc.pid)], stdout: "ignore", stderr: "ignore" });
				} catch {
					// best-effort
				}
			}
		}, timeout);

		const readDeadline = Date.now() + timeout + KILL_DRAIN_GRACE_MS;
		const [stdout, stderr] = await Promise.all([
			readUntilDeadline(proc.stdout as ReadableStream<Uint8Array>, readDeadline),
			readUntilDeadline(proc.stderr as ReadableStream<Uint8Array>, readDeadline),
		]);
		const exitCode = await Promise.race([
			proc.exited,
			new Promise<number>((resolve) => setTimeout(() => resolve(-1), KILL_DRAIN_GRACE_MS)),
		]);
		clearTimeout(timer);

		return {
			ok: !timedOut && exitCode === 0,
			value: { stdout, stderr, exitCode: timedOut ? -1 : exitCode, timedOut },
			error: timedOut ? `command timed out after ${timeout}ms` : undefined,
		};
	},
};
