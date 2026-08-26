import { decodeMessages, encodeMessage } from "./protocol";
import { connectToDaemon, readDaemonRuntimeInfo } from "./ws-client";

/**
 * Entry point run by Chrome via native messaging (stdin/stdout, length-prefixed JSON) — see
 * protocol.ts. On startup it also connects to the local daemon and registers as the browser
 * bridge so browser.* requests can be forwarded to the extension (Phase 4b/4c wire the actual
 * forwarding logic on top of this skeleton).
 */
async function main(): Promise<void> {
	let buffer: Buffer = Buffer.alloc(0);
	process.stdin.on("data", (chunk: Buffer) => {
		buffer = Buffer.concat([buffer, chunk]) as Buffer;
		const { messages, rest } = decodeMessages(buffer);
		buffer = rest;
		for (const message of messages) {
			handleExtensionMessage(message);
		}
	});

	try {
		const runtimeInfo = await readDaemonRuntimeInfo();
		await connectToDaemon(runtimeInfo);
	} catch (err) {
		process.stderr.write(`[native-host] failed to connect to daemon: ${err instanceof Error ? err.message : String(err)}\n`);
	}
}

function handleExtensionMessage(message: unknown): void {
	// Phase 4b/4c forward this to the daemon's browser.* bridge and relay responses back.
	void message;
}

export function sendToExtension(message: unknown): void {
	process.stdout.write(encodeMessage(message));
}

if (import.meta.main) {
	void main();
}
