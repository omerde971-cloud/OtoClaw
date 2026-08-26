/**
 * Minimal JSON-RPC/WS client: id-correlated request/response plus notification
 * subscriptions. Phase 1 keeps this simple on purpose — no reconnect/retry logic.
 */
export interface JsonRpcErrorLike {
	code: number;
	message: string;
}

type Listener = (params: unknown) => void;

export class WsClient {
	private readonly ws: WebSocket;
	private nextId = 1;
	private readonly pending = new Map<
		number,
		{ resolve: (value: unknown) => void; reject: (err: Error) => void }
	>();
	private readonly listeners = new Map<string, Set<Listener>>();
	private readonly openPromise: Promise<void>;
	private closed = false;

	constructor(url: string) {
		this.ws = new WebSocket(url);
		this.openPromise = new Promise((resolve, reject) => {
			this.ws.onopen = () => resolve();
			this.ws.onerror = () => reject(new Error(`failed to connect to ${url}`));
		});
		this.ws.onmessage = (event) => this.handleMessage(String(event.data));
		this.ws.onclose = () => this.handleClose();
	}

	async connect(): Promise<void> {
		await this.openPromise;
	}

	request<TResult = unknown>(method: string, params: unknown): Promise<TResult> {
		if (this.closed) {
			return Promise.reject(new Error("connection is closed"));
		}
		const id = this.nextId++;
		return new Promise<TResult>((resolve, reject) => {
			this.pending.set(id, {
				resolve: resolve as (value: unknown) => void,
				reject,
			});
			this.ws.send(JSON.stringify({ jsonrpc: "2.0", id, method, params }));
		});
	}

	/** Subscribes to a notification method; returns an unsubscribe function. */
	on(method: string, listener: Listener): () => void {
		let set = this.listeners.get(method);
		if (!set) {
			set = new Set();
			this.listeners.set(method, set);
		}
		set.add(listener);
		return () => set?.delete(listener);
	}

	close(): void {
		this.closed = true;
		this.ws.close();
	}

	private handleMessage(raw: string): void {
		let msg: Record<string, unknown>;
		try {
			msg = JSON.parse(raw);
		} catch {
			return;
		}

		if ("id" in msg && msg.id !== null && msg.id !== undefined) {
			const pending = this.pending.get(msg.id as number);
			if (!pending) return;
			this.pending.delete(msg.id as number);
			if (msg.error) {
				const err = msg.error as JsonRpcErrorLike;
				pending.reject(new Error(err.message));
			} else {
				pending.resolve(msg.result);
			}
			return;
		}

		if (typeof msg.method === "string") {
			const set = this.listeners.get(msg.method);
			if (set) {
				for (const listener of set) listener(msg.params);
			}
		}
	}

	private handleClose(): void {
		this.closed = true;
		for (const [, pending] of this.pending) {
			pending.reject(new Error("connection closed"));
		}
		this.pending.clear();
	}
}
