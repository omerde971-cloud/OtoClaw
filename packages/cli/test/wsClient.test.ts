import { afterEach, describe, expect, test } from "bun:test";
import { WsClient } from "../src/wsClient";

let server: ReturnType<typeof Bun.serve> | null = null;

afterEach(() => {
	server?.stop(true);
	server = null;
});

function startFakeServer(
	onMessage: (ws: { send: (data: string) => void }, msg: Record<string, unknown>) => void,
): number {
	server = Bun.serve({
		hostname: "127.0.0.1",
		port: 0,
		fetch(req, srv) {
			if (srv.upgrade(req)) return undefined;
			return new Response("expected websocket", { status: 400 });
		},
		websocket: {
			message(ws, raw) {
				onMessage(ws, JSON.parse(raw.toString()));
			},
		},
	});
	return server.port;
}

describe("WsClient", () => {
	test("correlates request/response by id", async () => {
		const port = startFakeServer((ws, msg) => {
			ws.send(JSON.stringify({ jsonrpc: "2.0", id: msg.id, result: { echoed: msg.params } }));
		});

		const client = new WsClient(`ws://127.0.0.1:${port}`);
		await client.connect();

		const result = await client.request<{ echoed: unknown }>("test.echo", { hello: "world" });
		expect(result.echoed).toEqual({ hello: "world" });

		const secondResult = await client.request<{ echoed: unknown }>("test.echo", { n: 2 });
		expect(secondResult.echoed).toEqual({ n: 2 });

		client.close();
	});

	test("rejects the request promise on a JSON-RPC error", async () => {
		const port = startFakeServer((ws, msg) => {
			ws.send(JSON.stringify({ jsonrpc: "2.0", id: msg.id, error: { code: -1, message: "boom" } }));
		});

		const client = new WsClient(`ws://127.0.0.1:${port}`);
		await client.connect();

		await expect(client.request("test.fail", {})).rejects.toThrow("boom");
		client.close();
	});

	test("dispatches notifications (no id) to subscribed listeners", async () => {
		const port = startFakeServer((ws) => {
			ws.send(JSON.stringify({ jsonrpc: "2.0", method: "server.ping", params: { n: 1 } }));
			ws.send(JSON.stringify({ jsonrpc: "2.0", method: "server.ping", params: { n: 2 } }));
		});

		const client = new WsClient(`ws://127.0.0.1:${port}`);
		await client.connect();

		const received: unknown[] = [];
		client.on("server.ping", (params) => received.push(params));

		// trigger the server to push notifications by sending any request
		void client.request("noop", {}).catch(() => {});

		await new Promise((resolve) => setTimeout(resolve, 100));
		expect(received).toEqual([{ n: 1 }, { n: 2 }]);

		client.close();
	});

	test("rejects pending requests when the connection closes", async () => {
		const port = startFakeServer(() => {
			// never respond
		});

		const client = new WsClient(`ws://127.0.0.1:${port}`);
		await client.connect();

		const pending = client.request("never.responds", {});
		client.close();

		await expect(pending).rejects.toThrow();
	});
});
