import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { render } from "ink";
import { createElement } from "react";
import { App } from "./App";
import { WsClient } from "./wsClient";

function otoclawDir(): string {
	return join(homedir(), ".otoclaw");
}

function daemonJsonPath(): string {
	return join(otoclawDir(), "daemon.json");
}

interface DaemonInfo {
	port: number;
	token: string;
}

function readDaemonInfo(): DaemonInfo | null {
	const path = daemonJsonPath();
	if (!existsSync(path)) return null;
	try {
		const parsed = JSON.parse(readFileSync(path, "utf8")) as Partial<DaemonInfo>;
		if (typeof parsed.port === "number" && typeof parsed.token === "string") {
			return { port: parsed.port, token: parsed.token };
		}
	} catch {
		// stale/corrupt file — treat as absent
	}
	return null;
}

async function tryConnect(info: DaemonInfo): Promise<WsClient | null> {
	const client = new WsClient(`ws://127.0.0.1:${info.port}/ws?token=${info.token}`);
	try {
		await client.connect();
		return client;
	} catch {
		return null;
	}
}

async function waitForDaemon(timeoutMs = 5000): Promise<DaemonInfo> {
	const start = Date.now();
	while (Date.now() - start < timeoutMs) {
		const info = readDaemonInfo();
		if (info) return info;
		await new Promise((resolve) => setTimeout(resolve, 100));
	}
	throw new Error("otoclaw daemon did not start in time");
}

/**
 * Dev mode (`bun run packages/cli/src/index.tsx`) has the daemon's TS source
 * on disk next to this file, so `bun run` on it works directly. A `bun build
 * --compile` binary has no source files embedded on disk — only the sibling
 * `otoclaw-daemon` binary (built by scripts/build-binary.ts) that this branch
 * spawns instead.
 */
function spawnDaemon(): void {
	const daemonEntry = join(import.meta.dir, "..", "..", "daemon", "src", "main.ts");
	if (existsSync(daemonEntry)) {
		Bun.spawn(["bun", "run", daemonEntry], {
			stdout: "ignore",
			stderr: "ignore",
			stdin: "ignore",
		});
		return;
	}

	const exeSuffix = process.platform === "win32" ? ".exe" : "";
	const siblingDaemon = join(dirname(process.execPath), `otoclaw-daemon${exeSuffix}`);
	if (!existsSync(siblingDaemon)) {
		throw new Error(
			`could not find the otoclaw daemon: no source at ${daemonEntry} and no sibling binary at ${siblingDaemon}`,
		);
	}
	Bun.spawn([siblingDaemon], {
		stdout: "ignore",
		stderr: "ignore",
		stdin: "ignore",
	});
}

async function ensureConnectedClient(): Promise<WsClient> {
	const existing = readDaemonInfo();
	if (existing) {
		const client = await tryConnect(existing);
		if (client) return client;
	}

	spawnDaemon();
	const info = await waitForDaemon();
	const client = await tryConnect(info);
	if (!client) throw new Error("failed to connect to the otoclaw daemon after starting it");
	return client;
}

async function main(): Promise<void> {
	const client = await ensureConnectedClient();
	render(createElement(App, { client, cwd: process.cwd() }));
}

void main();
