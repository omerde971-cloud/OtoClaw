import { existsSync } from "node:fs";
import { cp, rm } from "node:fs/promises";
import { join } from "node:path";

const root = import.meta.dir;
const srcDir = join(root, "src");
const distDir = join(root, "dist");

if (existsSync(distDir)) {
	await rm(distDir, { recursive: true, force: true });
}

await cp(srcDir, distDir, { recursive: true });

console.log(`built ${srcDir} -> ${distDir}`);
