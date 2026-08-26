import { afterAll, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fsEdit, fsRead, fsWrite } from "../src/fs";
import type { ToolContext } from "../src/types";

const scratchDirs: string[] = [];
afterAll(() => {
	for (const dir of scratchDirs.splice(0)) {
		try {
			rmSync(dir, { recursive: true, force: true });
		} catch {
			// best-effort cleanup
		}
	}
});

function makeCtx(): ToolContext {
	const dir = mkdtempSync(join(tmpdir(), "otoclaw-fs-"));
	scratchDirs.push(dir);
	return { cwd: dir, sessionId: randomUUID() };
}

test("fs.write then fs.read round-trips content and produces a diff", async () => {
	const ctx = makeCtx();
	const writeResult = await fsWrite.run({ path: "hello.txt", content: "hello world" }, ctx);
	expect(writeResult.ok).toBe(true);
	expect(writeResult.value?.diff).toContain("+hello world");

	const readResult = await fsRead.run({ path: "hello.txt" }, ctx);
	expect(readResult.ok).toBe(true);
	expect(readResult.value?.content).toBe("hello world");
	expect(existsSync(join(ctx.cwd, "hello.txt"))).toBe(true);
});

test("fs.edit performs exact-match find/replace", async () => {
	const ctx = makeCtx();
	await fsWrite.run({ path: "edit.txt", content: "foo bar baz" }, ctx);

	const editResult = await fsEdit.run({ path: "edit.txt", find: "bar", replace: "qux" }, ctx);
	expect(editResult.ok).toBe(true);
	expect(editResult.value?.diff).toContain("+foo qux baz");

	const content = readFileSync(join(ctx.cwd, "edit.txt"), "utf8");
	expect(content).toBe("foo qux baz");
});

test("fs.edit fails when the find string is not present", async () => {
	const ctx = makeCtx();
	await fsWrite.run({ path: "edit2.txt", content: "one two three" }, ctx);

	const result = await fsEdit.run({ path: "edit2.txt", find: "missing", replace: "x" }, ctx);
	expect(result.ok).toBe(false);
	expect(result.error).toBeDefined();
});

test("fs.edit fails when the find string is not unique", async () => {
	const ctx = makeCtx();
	await fsWrite.run({ path: "edit3.txt", content: "dup dup dup" }, ctx);

	const result = await fsEdit.run({ path: "edit3.txt", find: "dup", replace: "x" }, ctx);
	expect(result.ok).toBe(false);
	expect(result.error).toContain("not unique");
});

test("fs.read/write reject paths that escape the cwd jail", async () => {
	const ctx = makeCtx();
	const readResult = await fsRead.run({ path: "../outside.txt" }, ctx);
	expect(readResult.ok).toBe(false);

	const writeResult = await fsWrite.run({ path: "../outside.txt", content: "nope" }, ctx);
	expect(writeResult.ok).toBe(false);
	expect(existsSync(join(ctx.cwd, "..", "outside.txt"))).toBe(false);
});

test("fs.read supports a line range", async () => {
	const ctx = makeCtx();
	await fsWrite.run({ path: "lines.txt", content: "one\ntwo\nthree\nfour" }, ctx);

	const result = await fsRead.run({ path: "lines.txt", range: { start: 2, end: 3 } }, ctx);
	expect(result.ok).toBe(true);
	expect(result.value?.content).toBe("two\nthree");
});
