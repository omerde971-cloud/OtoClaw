import { afterAll, describe, expect, test } from "bun:test";
import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createWorktree, discardWorktree, finalizeWorktree } from "../src/worktree";

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

function initRepo(): string {
	const dir = mkdtempSync(join(tmpdir(), "otoclaw-worktree-repo-"));
	scratchDirs.push(dir);
	execSync("git init -q", { cwd: dir });
	execSync('git config user.email "test@otoclaw.dev"', { cwd: dir });
	execSync('git config user.name "OtoClaw Test"', { cwd: dir });
	writeFileSync(join(dir, "README.md"), "hello\n");
	execSync("git add -A", { cwd: dir });
	execSync('git commit -q -m "init"', { cwd: dir });
	return dir;
}

describe("worktree", () => {
	test("a worktree with no changes is discarded, not left behind", async () => {
		const repo = initRepo();
		const handle = await createWorktree(repo, randomUUID());
		expect(existsSync(handle.path)).toBe(true);

		const result = await finalizeWorktree(handle);

		expect(result).toBeNull();
		expect(existsSync(handle.path)).toBe(false);
	});

	test("a worktree with changes captures the diff, is left in place, and is never merged into the main repo", async () => {
		const repo = initRepo();
		const handle = await createWorktree(repo, randomUUID());
		writeFileSync(join(handle.path, "new-file.txt"), "sub-agent output\n");

		const result = await finalizeWorktree(handle);

		expect(result).not.toBeNull();
		expect(result?.branch).toBe(handle.branch);
		expect(result?.diff).toContain("new-file.txt");
		expect(existsSync(handle.path)).toBe(true);
		expect(existsSync(join(repo, "new-file.txt"))).toBe(false);

		await discardWorktree(handle);
		expect(existsSync(handle.path)).toBe(false);
	});
});
