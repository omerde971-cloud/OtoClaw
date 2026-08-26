import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { capture } from "../src/capture";
import type { ScreenCaptureProvider } from "../src/capture";

const FAKE_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x01, 0x02, 0x03]);

class FakeScreenCaptureProvider implements ScreenCaptureProvider {
	async capture(): Promise<Buffer> {
		return FAKE_BYTES;
	}
}

let fakeHome: string;
let originalUserProfile: string | undefined;
let originalHome: string | undefined;

beforeEach(async () => {
	fakeHome = await mkdtemp(join(tmpdir(), "otoclaw-vision-test-"));
	originalUserProfile = process.env.USERPROFILE;
	originalHome = process.env.HOME;
	// os.homedir() reads these env vars dynamically, so pointing them at a scratch dir keeps
	// this test from ever touching the real user's ~/.otoclaw cache.
	process.env.USERPROFILE = fakeHome;
	process.env.HOME = fakeHome;
});

afterEach(async () => {
	process.env.USERPROFILE = originalUserProfile;
	process.env.HOME = originalHome;
	await rm(fakeHome, { recursive: true, force: true });
});

describe("capture", () => {
	test("writes the captured buffer to ~/.otoclaw/cache/vision/<frameId>.png", async () => {
		const result = await capture(
			{ sessionId: "s1" },
			new FakeScreenCaptureProvider(),
		);

		expect(result.frameId).toBeTruthy();
		expect(result.path).toBe(
			join(fakeHome, ".otoclaw", "cache", "vision", `${result.frameId}.png`),
		);

		const written = await readFile(result.path);
		expect(Buffer.compare(written, FAKE_BYTES)).toBe(0);
	});

	test("frameId is unique across calls", async () => {
		const provider = new FakeScreenCaptureProvider();
		const first = await capture({ sessionId: "s1" }, provider);
		const second = await capture({ sessionId: "s1" }, provider);

		expect(first.frameId).not.toBe(second.frameId);
		expect(first.path).not.toBe(second.path);
	});

	test("creates the cache directory when it does not exist yet", async () => {
		const provider = new FakeScreenCaptureProvider();
		const result = await capture({ sessionId: "s1" }, provider);
		const written = await readFile(result.path);
		expect(written.length).toBeGreaterThan(0);
	});
});
