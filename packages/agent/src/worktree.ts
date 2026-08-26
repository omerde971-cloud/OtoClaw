import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface WorktreeHandle {
	path: string;
	branch: string;
	repoRoot: string;
}

export interface WorktreeDiff {
	path: string;
	branch: string;
	diff: string;
}

function run(cmd: string, args: string[], cwd: string): Promise<{ ok: boolean; stdout: string; stderr: string }> {
	return new Promise((resolve) => {
		const child = spawn(cmd, args, { cwd });
		let stdout = "";
		let stderr = "";
		child.stdout?.on("data", (chunk) => {
			stdout += chunk.toString();
		});
		child.stderr?.on("data", (chunk) => {
			stderr += chunk.toString();
		});
		child.on("close", (code) => resolve({ ok: code === 0, stdout, stderr }));
		child.on("error", (err) => resolve({ ok: false, stdout, stderr: err.message }));
	});
}

/** Creates an isolated git worktree on a fresh branch off `repoRoot`'s current HEAD. */
export async function createWorktree(repoRoot: string, agentId: string): Promise<WorktreeHandle> {
	const branch = `otoclaw/subagent/${agentId}`;
	const path = join(tmpdir(), `otoclaw-worktree-${agentId}`);
	const result = await run("git", ["worktree", "add", path, "-b", branch], repoRoot);
	if (!result.ok) {
		throw new Error(`git worktree add failed: ${result.stderr.trim() || result.stdout.trim()}`);
	}
	return { path, branch, repoRoot };
}

/**
 * Isolation only, per project decision: never merges. If the worktree has no changes it is
 * discarded and null is returned; if it has changes, the diff is captured (worktree left in
 * place, on its branch) for a later review/merge decision.
 */
export async function finalizeWorktree(handle: WorktreeHandle): Promise<WorktreeDiff | null> {
	const status = await run("git", ["status", "--porcelain"], handle.path);
	if (status.stdout.trim().length === 0) {
		await discardWorktree(handle);
		return null;
	}

	// stage untracked/modified/deleted files so `git diff --cached` captures everything, including new files
	await run("git", ["add", "-A"], handle.path);
	const diff = await run("git", ["diff", "--cached"], handle.path);
	return { path: handle.path, branch: handle.branch, diff: diff.stdout };
}

export async function discardWorktree(handle: WorktreeHandle): Promise<void> {
	await run("git", ["worktree", "remove", "--force", handle.path], handle.repoRoot);
}
