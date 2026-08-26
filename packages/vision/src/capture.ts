import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { CaptureInput, CaptureResult } from "./types";

export interface ScreenCaptureProvider {
	capture(region?: { x: number; y: number; w: number; h: number }): Promise<Buffer>;
}

// Smallest possible valid PNG (1x1, transparent).
const BLANK_PNG_BASE64 =
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

/**
 * WHY: real OS-level screen capture needs a native binding (e.g. a screenshot-desktop /
 * robotjs-style package), and none of the common options have verified Bun compatibility on
 * Windows. Wiring that up is a separate technical decision deferred past Phase 4 — this
 * fallback keeps capture() fully functional (real file on disk, real frameId) so callers and
 * the vision-model route can be built and tested now. Swap in a real provider via the
 * `provider` param of capture() once one is chosen.
 */
export class NoopScreenCaptureProvider implements ScreenCaptureProvider {
	async capture(): Promise<Buffer> {
		return Buffer.from(BLANK_PNG_BASE64, "base64");
	}
}

function cacheDir(): string {
	return join(homedir(), ".otoclaw", "cache", "vision");
}

/** Path convention shared with describe(), which looks frames up by frameId. */
export function framePath(frameId: string): string {
	return join(cacheDir(), `${frameId}.png`);
}

export async function capture(
	input: CaptureInput,
	provider: ScreenCaptureProvider = new NoopScreenCaptureProvider(),
): Promise<CaptureResult> {
	const buffer = await provider.capture(input.region);
	const frameId = randomUUID();
	await mkdir(cacheDir(), { recursive: true });
	const path = framePath(frameId);
	await writeFile(path, buffer);
	return { frameId, path };
}
