#!/usr/bin/env bun
/**
 * Registers the OtoClaw Bridge native messaging host with Chrome (Windows only, HKCU — this
 * is a per-user registration, not a system-wide install). Run this after loading the
 * unpacked extension so the extension ID (only known once Chrome assigns it) can be baked
 * into the host manifest's `allowed_origins`.
 *
 * Usage: bun run scripts/install-native-host.ts <extensionId>
 */

import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { buildManifest, installOnWindows } from "../native-host/src/manifest-installer";

const extensionId = process.argv[2];
if (!extensionId) {
	console.error("Usage: bun run scripts/install-native-host.ts <extensionId>");
	console.error("Find <extensionId> on chrome://extensions after loading apps/extension/dist/ as an unpacked extension.");
	process.exit(1);
}
if (!/^[a-p]{32}$/.test(extensionId)) {
	console.error(`[install-native-host] "${extensionId}" doesn't look like a Chrome extension ID (32 lowercase a-p letters).`);
	process.exit(1);
}

if (process.platform !== "win32") {
	console.error("[install-native-host] only Windows registration is implemented (HKCU registry key).");
	process.exit(1);
}

const ROOT = join(import.meta.dir, "..");
const hostExecutablePath = join(ROOT, "native-host", "dist", "otoclaw-bridge.exe");
if (!existsSync(hostExecutablePath)) {
	console.error(`[install-native-host] ${hostExecutablePath} not found — run "bun run build.ts" in apps/extension/native-host first.`);
	process.exit(1);
}

const manifestPath = join(homedir(), ".otoclaw", "native-messaging-host-manifest.json");
const manifest = buildManifest(hostExecutablePath, extensionId);

async function writeManifestFile(path: string, contents: string): Promise<void> {
	await mkdir(dirname(path), { recursive: true });
	await writeFile(path, contents, "utf8");
}

async function writeRegistryValue(keyPath: string, valueName: string, value: string): Promise<void> {
	const proc = Bun.spawn(["reg", "add", keyPath, "/ve", "/t", "REG_SZ", "/d", value, "/f"], {
		stdout: "pipe",
		stderr: "pipe",
	});
	const exitCode = await proc.exited;
	if (exitCode !== 0) {
		const stderr = await new Response(proc.stderr).text();
		throw new Error(`reg add failed (exit ${exitCode}): ${stderr}`);
	}
	void valueName; // reg add's /ve targets the key's (Default) value directly.
}

await installOnWindows(manifest, manifestPath, writeManifestFile, writeRegistryValue);

console.log(`[install-native-host] wrote host manifest: ${manifestPath}`);
console.log(`[install-native-host] registered HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\com.otoclaw.bridge -> ${manifestPath}`);
console.log(`[install-native-host] allowed_origins: chrome-extension://${extensionId}/`);
