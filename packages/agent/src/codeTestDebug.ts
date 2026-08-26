import type { ChatMessage } from "@otoclaw/providers";
import { runModelToolTurn } from "./loop";
import type { PlanStep, RunContext } from "./types";

/** write -> shell test -> feed failure back to the model -> retry, bounded so a stuck loop can't hang a run. */
const MAX_ATTEMPTS = 3;

export interface CodeTestDebugInput {
	step: PlanStep;
	testCommand: string;
	ctx: RunContext;
}

export interface CodeTestDebugResult {
	resolved: boolean;
	attempts: number;
	notes: string[];
}

function describeFailure(result: { ok: boolean; value?: unknown; error?: string }): string {
	if (result.error) return result.error;
	const value = result.value as { stdout?: string; stderr?: string; exitCode?: number } | undefined;
	if (value) {
		return `exit code ${value.exitCode ?? "unknown"}: ${(value.stderr || value.stdout || "").trim()}`;
	}
	return "test command failed";
}

/**
 * Runs the step's test command; on failure, feeds the error back to the model for a fix turn
 * (which may itself call fs.write/fs.edit tools) and retries, bounded at MAX_ATTEMPTS. Never
 * throws on exhaustion — the step is marked unresolved and review() surfaces it.
 */
export async function codeTestDebug(input: CodeTestDebugInput): Promise<CodeTestDebugResult> {
	const { step, testCommand, ctx } = input;
	const shellTool = ctx.toolRegistry.get("shell.run");
	if (!shellTool) {
		return { resolved: false, attempts: 0, notes: ["shell.run tool is not registered"] };
	}

	let lastFailure = "";
	for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
		const testResult = await shellTool.run({ cmd: testCommand, timeout: 120_000 }, ctx.toolContext);
		if (testResult.ok) {
			return { resolved: true, attempts: attempt, notes: [] };
		}

		lastFailure = describeFailure(testResult);
		if (attempt === MAX_ATTEMPTS) break;

		const fixMessages: ChatMessage[] = [
			{
				role: "user",
				content: `The test command for step "${step.description}" failed:\n${lastFailure}\n\nFix the code so the tests pass.`,
			},
		];
		await runModelToolTurn(fixMessages, ctx);
	}

	return {
		resolved: false,
		attempts: MAX_ATTEMPTS,
		notes: [`unresolved failure after ${MAX_ATTEMPTS} attempts: ${lastFailure}`],
	};
}
