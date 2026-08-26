/**
 * Chrome native messaging wire format: each message is a 4-byte little-endian length prefix
 * followed by that many bytes of UTF-8-encoded JSON. See:
 * https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging
 */

export function encodeMessage(message: unknown): Buffer {
	const json = Buffer.from(JSON.stringify(message), "utf8");
	const header = Buffer.alloc(4);
	header.writeUInt32LE(json.byteLength, 0);
	return Buffer.concat([header, json]);
}

/**
 * Incrementally feed raw bytes in; returns any complete messages found and the leftover
 * (possibly partial) tail buffer to keep accumulating.
 */
export function decodeMessages(buffer: Buffer): { messages: unknown[]; rest: Buffer } {
	const messages: unknown[] = [];
	let offset = 0;
	while (buffer.byteLength - offset >= 4) {
		const length = buffer.readUInt32LE(offset);
		const bodyStart = offset + 4;
		const bodyEnd = bodyStart + length;
		if (buffer.byteLength < bodyEnd) break;
		const json = buffer.subarray(bodyStart, bodyEnd).toString("utf8");
		messages.push(JSON.parse(json));
		offset = bodyEnd;
	}
	return { messages, rest: buffer.subarray(offset) };
}
