import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, expect, test } from "bun:test";
import { chromium, type Browser, type Page } from "playwright";

/**
 * Real-browser proof for the content-script automation helpers. Bundles dom-automation.ts
 * (and its cursor-overlay/synthetic-events dependencies) into a self-contained ESM module,
 * serves it alongside the static test fixture, and drives headless Chromium against it —
 * jsdom/happy-dom can't validate real getBoundingClientRect()/focus()/event-dispatch behavior.
 */

const FIXTURE_HTML = readFileSync(join(import.meta.dir, "..", "test-fixtures", "automation-target.html"), "utf8");

interface AutomationModule {
	findElement(selectorOrText: string): Element | null;
	clickElement(selector: string): Promise<boolean>;
	typeInto(selector: string, text: string): Promise<boolean>;
	waitForSelector(selector: string, timeoutMs?: number): Promise<Element | null>;
}

declare global {
	interface Window {
		__automation: AutomationModule;
	}
}

let server: ReturnType<typeof Bun.serve>;
let browser: Browser;
let page: Page;

beforeAll(async () => {
	const build = await Bun.build({
		entrypoints: [join(import.meta.dir, "..", "src", "content", "dom-automation.ts")],
		format: "esm",
		target: "browser",
	});
	if (!build.success) {
		throw new AggregateError(build.logs, "failed to bundle dom-automation.ts for the browser");
	}
	const bundleCode = await build.outputs[0]?.text();
	if (!bundleCode) throw new Error("bundle produced no output");

	server = Bun.serve({
		port: 0,
		fetch(req) {
			const { pathname } = new URL(req.url);
			if (pathname === "/dom-automation.mjs") {
				return new Response(bundleCode, { headers: { "content-type": "application/javascript" } });
			}
			return new Response(FIXTURE_HTML, { headers: { "content-type": "text/html" } });
		},
	});

	browser = await chromium.launch();
	page = await browser.newPage();
	await page.goto(`http://localhost:${server.port}/`);
	await page.evaluate(async () => {
		const mod = await import("/dom-automation.mjs");
		window.__automation = mod as unknown as Window["__automation"];
	});
}, 60_000);

afterAll(async () => {
	await browser?.close();
	server?.stop(true);
});

test("findElement locates the input by CSS selector", async () => {
	const found = await page.evaluate(() => Boolean(window.__automation.findElement("#name-input")));
	expect(found).toBe(true);
});

test("findElement locates the button by its visible text", async () => {
	const found = await page.evaluate(() => Boolean(window.__automation.findElement("Submit")));
	expect(found).toBe(true);
});

test("typeInto writes into the input via real synthetic keyboard/input events", async () => {
	const ok = await page.evaluate(() => window.__automation.typeInto("#name-input", "Ada"));
	expect(ok).toBe(true);
	const value = await page.$eval("#name-input", (el) => (el as HTMLInputElement).value);
	expect(value).toBe("Ada");
});

test("clickElement clicks the submit button and the page updates the result div", async () => {
	const ok = await page.evaluate(() => window.__automation.clickElement("#submit-btn"));
	expect(ok).toBe(true);
	await page.waitForFunction(() => (document.getElementById("result")?.textContent ?? "").length > 0);
	const resultText = await page.$eval("#result", (el) => el.textContent);
	expect(resultText).toBe("Hello, Ada!");
});

test("clickElement returns false for a selector that matches nothing", async () => {
	const ok = await page.evaluate(() => window.__automation.clickElement("#does-not-exist"));
	expect(ok).toBe(false);
});

test("waitForSelector resolves once a selector appears in the DOM", async () => {
	const found = await page.evaluate(async () => {
		const el = document.createElement("div");
		el.id = "late-arrival";
		setTimeout(() => document.body.appendChild(el), 150);
		const result = await window.__automation.waitForSelector("#late-arrival", 2000);
		return result !== null;
	});
	expect(found).toBe(true);
});
