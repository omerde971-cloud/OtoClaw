import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";
import { cacheDir } from "./web";
import type { Tool, ToolResult } from "./types";

interface FillAction {
	type: "fill";
	selector: string;
	value: string;
}

interface ClickAction {
	type: "click";
	selector: string;
}

interface WaitForSelectorAction {
	type: "waitForSelector";
	selector: string;
	timeoutMs?: number;
}

interface ScreenshotAction {
	type: "screenshot";
}

interface AssertTextAction {
	type: "assertText";
	selector: string;
	contains: string;
}

type BrowserAction = FillAction | ClickAction | WaitForSelectorAction | ScreenshotAction | AssertTextAction;

interface BrowserTestArgs {
	url: string;
	actions: BrowserAction[];
}

interface StepLog {
	action: BrowserAction;
	ok: boolean;
	error?: string;
}

interface BrowserTestValue {
	steps: StepLog[];
	screenshotPaths: string[];
}

function screenshotsDir(dirOverride?: string): string {
	return dirOverride ?? cacheDir();
}

export function createBrowserTestTool(
	launchImpl: typeof chromium.launch = chromium.launch.bind(chromium),
	screenshotDirOverride?: string,
): Tool<BrowserTestArgs, BrowserTestValue> {
	return {
		name: "browser.test",
		description: "Run a headless Playwright flow against a URL: fill forms, click, wait, screenshot, assert text.",
		permissionKey: "browser",
		schema: {
			type: "object",
			properties: {
				url: { type: "string" },
				actions: { type: "array" },
			},
			required: ["url", "actions"],
		},
		async run(args): Promise<ToolResult<BrowserTestValue>> {
			const steps: StepLog[] = [];
			const screenshotPaths: string[] = [];

			const browser = await launchImpl({ headless: true });
			try {
				const page = await browser.newPage();
				try {
					await page.goto(args.url);
				} catch (err) {
					const message = err instanceof Error ? err.message : String(err);
					return { ok: false, value: { steps, screenshotPaths }, error: `goto failed: ${message}` };
				}

				for (const action of args.actions) {
					try {
						switch (action.type) {
							case "fill":
								await page.fill(action.selector, action.value);
								steps.push({ action, ok: true });
								break;
							case "click":
								await page.click(action.selector);
								steps.push({ action, ok: true });
								break;
							case "waitForSelector":
								await page.waitForSelector(action.selector, { timeout: action.timeoutMs });
								steps.push({ action, ok: true });
								break;
							case "screenshot": {
								const dir = screenshotsDir(screenshotDirOverride);
								await mkdir(dir, { recursive: true });
								const path = `${dir}/${randomUUID()}.png`;
								await page.screenshot({ path });
								screenshotPaths.push(path);
								steps.push({ action, ok: true });
								break;
							}
							case "assertText": {
								const text = await page.textContent(action.selector);
								const found = (text ?? "").includes(action.contains);
								if (!found) {
									const error = `assertText failed: selector "${action.selector}" text "${text ?? ""}" does not contain "${action.contains}"`;
									steps.push({ action, ok: false, error });
									return { ok: false, value: { steps, screenshotPaths }, error };
								}
								steps.push({ action, ok: true });
								break;
							}
						}
					} catch (err) {
						const message = err instanceof Error ? err.message : String(err);
						steps.push({ action, ok: false, error: message });
						return { ok: false, value: { steps, screenshotPaths }, error: message };
					}
				}

				return { ok: true, value: { steps, screenshotPaths } };
			} finally {
				await browser.close();
			}
		},
	};
}

export const browserTest = createBrowserTestTool();
