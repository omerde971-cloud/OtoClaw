import { expect, test } from "bun:test";
import { decodeMessages, encodeMessage } from "../src/protocol";

test("encode/decode round trip for a single message", () => {
	const message = { jsonrpc: "2.0", id: 1, method: "bridge.register", params: { role: "bridge" } };
	const encoded = encodeMessage(message);

	// 4-byte little-endian length prefix.
	const jsonLength = Buffer.byteLength(JSON.stringify(message), "utf8");
	expect(encoded.readUInt32LE(0)).toBe(jsonLength);

	const { messages, rest } = decodeMessages(encoded);
	expect(messages).toEqual([message]);
	expect(rest.byteLength).toBe(0);
});

test("decodeMessages handles multiple concatenated messages in one buffer", () => {
	const a = { type: "a" };
	const b = { type: "b", nested: { unicode: "héllo 🎉" } };
	const buffer = Buffer.concat([encodeMessage(a), encodeMessage(b)]);

	const { messages, rest } = decodeMessages(buffer);
	expect(messages).toEqual([a, b]);
	expect(rest.byteLength).toBe(0);
});

test("decodeMessages leaves a partial trailing message in `rest` for the next chunk", () => {
	const full = encodeMessage({ type: "complete" });
	const partial = encodeMessage({ type: "incomplete-but-long-enough-to-matter" });
	const buffer = Buffer.concat([full, partial.subarray(0, partial.byteLength - 3)]);

	const { messages, rest } = decodeMessages(buffer);
	expect(messages).toEqual([{ type: "complete" }]);
	expect(rest.byteLength).toBeGreaterThan(0);

	// Feeding the missing bytes completes the second message.
	const { messages: second, rest: finalRest } = decodeMessages(Buffer.concat([rest, partial.subarray(partial.byteLength - 3)]));
	expect(second).toEqual([{ type: "incomplete-but-long-enough-to-matter" }]);
	expect(finalRest.byteLength).toBe(0);
});

test("decodeMessages returns nothing for an empty buffer", () => {
	const { messages, rest } = decodeMessages(Buffer.alloc(0));
	expect(messages).toEqual([]);
	expect(rest.byteLength).toBe(0);
});
