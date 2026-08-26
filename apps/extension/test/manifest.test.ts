import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const manifest = JSON.parse(readFileSync(join(import.meta.dir, "..", "manifest.json"), "utf8"));

test("manifest_version is 3 (MV3)", () => {
	expect(manifest.manifest_version).toBe(3);
});

test("declares the required permissions", () => {
	expect(manifest.permissions).toContain("activeTab");
	expect(manifest.permissions).toContain("scripting");
	expect(manifest.permissions).toContain("nativeMessaging");
});

test("background is a service worker (MV3, not a persistent background page)", () => {
	expect(manifest.background).toBeDefined();
	expect(typeof manifest.background.service_worker).toBe("string");
	expect(manifest.background.service_worker.length).toBeGreaterThan(0);
	expect(manifest.background.page).toBeUndefined();
});

test("declares at least one content script", () => {
	expect(Array.isArray(manifest.content_scripts)).toBe(true);
	expect(manifest.content_scripts.length).toBeGreaterThan(0);
	for (const entry of manifest.content_scripts) {
		expect(Array.isArray(entry.matches)).toBe(true);
		expect(entry.matches.length).toBeGreaterThan(0);
		expect(Array.isArray(entry.js)).toBe(true);
		expect(entry.js.length).toBeGreaterThan(0);
	}
});

test("has a name and version", () => {
	expect(typeof manifest.name).toBe("string");
	expect(manifest.name.length).toBeGreaterThan(0);
	expect(typeof manifest.version).toBe("string");
	expect(manifest.version.length).toBeGreaterThan(0);
});
