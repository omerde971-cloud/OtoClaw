/**
 * Stand-in for packages/cli/src/index.tsx's spawnDaemon() used only by
 * test/persistence.test.ts. Mirrors its dev-mode branch exactly (stdio ignored, subprocess
 * unref()ed) so the persistence test can spawn a real "CLI process -> daemon process" pair
 * and then kill/exit the "CLI" side to prove the daemon survives it.
 */
const daemonEntry = process.env.OTOCLAW_TEST_DAEMON_ENTRY;
if (!daemonEntry) {
	throw new Error("OTOCLAW_TEST_DAEMON_ENTRY not set");
}

const proc = Bun.spawn(["bun", "run", daemonEntry], {
	stdout: "ignore",
	stderr: "ignore",
	stdin: "ignore",
	detached: true,
});
proc.unref();
