import { afterAll, expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createBrowserTestTool } from "../src/browser-test";

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

function makeScreenshotDir(): string {
	const dir = mkdtempSync(join(tmpdir(), "otoclaw-browsertest-"));
	scratchDirs.push(dir);
	return dir;
}

const fixtureUrl = `file://${join(import.meta.dir, "..", "test-fixtures", "site", "index.html").replace(/\\/g, "/")}`;

test("browser.test fills a form, submits, screenshots, and asserts the success text — real headless chromium", async () => {
	const screenshotDir = makeScreenshotDir();
	const tool = createBrowserTestTool(undefined, screenshotDir);

	const result = await tool.run(
		{
			url: fixtureUrl,
			actions: [
				{ type: "fill", selector: "#name", value: "Ada" },
				{ type: "fill", selector: "#email", value: "ada@example.com" },
				{ type: "click", selector: "#submit-btn" },
				{ type: "waitForSelector", selector: "#success-message" },
				{ type: "screenshot" },
				{ type: "assertText", selector: "#success-message", contains: "Merhaba, Ada!" },
			],
		},
		{ cwd: ".", sessionId: "s1" },
	);

	expect(result.ok).toBe(true);
	expect(result.value?.steps.every((step) => step.ok)).toBe(true);
	expect(result.value?.screenshotPaths.length).toBe(1);
	const screenshotPath = result.value?.screenshotPaths[0];
	expect(screenshotPath).toBeDefined();
	if (screenshotPath) {
		expect(existsSync(screenshotPath)).toBe(true);
	}
}, 30_000);

test("browser.test returns ok:false with an error when a selector does not exist", async () => {
	const screenshotDir = makeScreenshotDir();
	const tool = createBrowserTestTool(undefined, screenshotDir);

	const result = await tool.run(
		{
			url: fixtureUrl,
			actions: [{ type: "waitForSelector", selector: "#does-not-exist", timeoutMs: 1000 }],
		},
		{ cwd: ".", sessionId: "s1" },
	);

	expect(result.ok).toBe(false);
	expect(result.error).toBeDefined();
	expect(result.value?.steps[0]?.ok).toBe(false);
}, 30_000);
