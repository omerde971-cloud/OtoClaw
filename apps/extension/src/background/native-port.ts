import type { NativeHostMessage } from "../shared/messages";

const NATIVE_HOST_NAME = "com.otoclaw.bridge";

/** Type-safe wrapper around chrome.runtime.connectNative's raw postMessage/onMessage port. */
export class NativePort {
	private port: chrome.runtime.Port | null = null;
	private readonly messageListeners = new Set<(message: NativeHostMessage) => void>();
	private readonly disconnectListeners = new Set<() => void>();

	connect(): void {
		if (this.port) return;
		const port = chrome.runtime.connectNative(NATIVE_HOST_NAME);
		port.onMessage.addListener((message: unknown) => {
			for (const listener of this.messageListeners) listener(message as NativeHostMessage);
		});
		port.onDisconnect.addListener(() => {
			this.port = null;
			for (const listener of this.disconnectListeners) listener();
		});
		this.port = port;
	}

	disconnect(): void {
		this.port?.disconnect();
		this.port = null;
	}

	get connected(): boolean {
		return this.port !== null;
	}

	send(message: NativeHostMessage): void {
		if (!this.port) throw new Error("native port not connected");
		this.port.postMessage(message);
	}

	onMessage(listener: (message: NativeHostMessage) => void): () => void {
		this.messageListeners.add(listener);
		return () => this.messageListeners.delete(listener);
	}

	onDisconnect(listener: () => void): () => void {
		this.disconnectListeners.add(listener);
		return () => this.disconnectListeners.delete(listener);
	}
}
