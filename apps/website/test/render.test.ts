import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { type Browser, type ConsoleMessage, chromium } from "playwright";

const fileUrl = new URL("../src/index.html", import.meta.url).href;

let browser: Browser;

beforeAll(async () => {
	browser = await chromium.launch();
});

afterAll(async () => {
	await browser.close();
});

describe("website index.html", () => {
	test("renders without console errors", async () => {
		const page = await browser.newPage();
		const errors: ConsoleMessage[] = [];
		page.on("console", (msg) => {
			if (msg.type() === "error") errors.push(msg);
		});
		page.on("pageerror", (err) => errors.push({ text: () => err.message } as ConsoleMessage));

		await page.goto(fileUrl);

		expect(await page.title()).toContain("OtoClaw");

		const h1 = await page.textContent("h1");
		expect(h1).toBeTruthy();
		expect(h1?.toLowerCase()).toContain("machine");

		const featureCards = await page.locator(".feature-card").count();
		expect(featureCards).toBeGreaterThanOrEqual(6);

		const platformButtons = await page.locator(".platform-btn").count();
		expect(platformButtons).toBe(3);

		const downloadCta = await page.locator('a[href="#download"]').count();
		expect(downloadCta).toBeGreaterThan(0);

		expect(errors.map((e) => e.text())).toEqual([]);

		await page.close();
	});
});
