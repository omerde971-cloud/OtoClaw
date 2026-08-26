#!/usr/bin/env bun
/**
 * Bundles the extension's TypeScript sources into plain JS Chrome can load directly, and
 * writes a matching manifest.json into dist/. Chrome cannot execute .ts files or bare
 * relative imports across files, so this replaces those with a single self-contained IIFE
 * per entry point (no "type": "module" needed on the background service worker, and content
 * scripts never support module imports at all).
 *
 * Usage: bun run build.ts   (outputs to apps/extension/dist/)
 */

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = import.meta.dir;
const OUT_DIR = join(ROOT, "dist");

const ENTRIES = [
	{ entry: join(ROOT, "src", "background", "service-worker.ts"), outdir: join(OUT_DIR, "background") },
	{ entry: join(ROOT, "src", "content", "bootstrap.ts"), outdir: join(OUT_DIR, "content") },
] as const;

if (existsSync(OUT_DIR)) rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });

for (const { entry, outdir } of ENTRIES) {
	const result = await Bun.build({
		entrypoints: [entry],
		outdir,
		format: "iife",
		target: "browser",
		minify: false,
		sourcemap: "none",
	});
	if (!result.success) {
		for (const message of result.logs) console.error(message.toString());
		throw new Error(`[build] failed to bundle ${entry}`);
	}
	console.log(`[build] ${entry} -> ${outdir}`);
}

// The source manifest.json is written for a parent-folder load (paths prefixed with
// "dist/"), since it also documents the pre-build layout. dist/manifest.json is what
// Chrome actually loads (Load unpacked -> dist/), so its paths must be relative to dist/
// itself, i.e. with that "dist/" prefix stripped.
const manifest = JSON.parse(readFileSync(join(ROOT, "manifest.json"), "utf8"));
manifest.background.service_worker = manifest.background.service_worker.replace(/^dist\//, "");
delete manifest.background.type;
manifest.content_scripts = manifest.content_scripts.map((entry: { js: string[]; [k: string]: unknown }) => ({
	...entry,
	js: entry.js.map((js) => js.replace(/^dist\//, "")),
}));
writeFileSync(join(OUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log(`[build] ${join(ROOT, "manifest.json")} -> ${join(OUT_DIR, "manifest.json")}`);

console.log("[build] done. Load apps/extension/dist/ as an unpacked extension in chrome://extensions.");
