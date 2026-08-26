import { GlobalRegistrator } from "@happy-dom/global-registrator";

/**
 * Mock-DOM proof for the Gmail/Calendar adapter (real selectors verified live against a
 * Turkish-locale Gmail/Calendar account by the CEO — this file validates the adapter's DOM
 * manipulation logic against a stand-in DOM shaped like the real one, not the live product).
 */

await GlobalRegistrator.register({ url: "https://mail.google.com/mail/u/0/#inbox" });

const { afterAll, afterEach, beforeEach, expect, test } = await import("bun:test");
const { googleAdapter } = await import("../src/adapters/google");

afterAll(async () => {
	await GlobalRegistrator.unregister();
});

afterEach(() => {
	document.body.innerHTML = "";
});

function setGmailInboxDom(): void {
	document.body.innerHTML = `
		<table>
			<tr role="row"><td>Alice — Re: budget — a quick heads up</td></tr>
			<tr role="row"><td>Bob — Standup notes — see attached</td></tr>
		</table>
	`;
}

function setGmailComposeDom(): void {
	document.body.innerHTML = `
		<div role="dialog">
			<div gh="cm">Compose</div>
			<input name="to" />
			<input name="subjectbox" />
			<div g_editable="true" contenteditable="true"></div>
		</div>
	`;
}

beforeEach(() => {
	window.happyDOM.setURL("https://mail.google.com/mail/u/0/#inbox");
});

test("openInbox() reads inbox rows into a summary list when already on Gmail", async () => {
	setGmailInboxDom();
	const rows = await googleAdapter.openInbox();
	expect(rows.length).toBe(2);
	expect(rows[0]?.summary).toContain("Alice");
	expect(rows[1]?.summary).toContain("Bob");
});

test("readThread() throws instead of navigating when called outside Gmail", async () => {
	window.happyDOM.setURL("https://example.com/");
	await expect(googleAdapter.readThread("thread-123")).rejects.toThrow();
});

test("readThread() extracts subject and per-message sender/body from the thread DOM", async () => {
	document.body.innerHTML = `
		<h2>Quarterly budget review</h2>
		<div role="listitem">
			<span email="alice@example.com">Alice</span>
			<span title="2026-08-20T10:00:00Z">Aug 20</span>
			Here is the budget draft.
		</div>
		<div role="listitem">
			<span email="bob@example.com">Bob</span>
			Looks good to me.
		</div>
	`;
	const thread = await googleAdapter.readThread("thread-123");
	expect(thread.threadId).toBe("thread-123");
	expect(thread.subject).toBe("Quarterly budget review");
	expect(thread.messages.length).toBe(2);
	expect(thread.messages[0]?.from).toBe("alice@example.com");
	expect(thread.messages[0]?.body).toContain("budget draft");
	expect(thread.messages[1]?.from).toBe("bob@example.com");
});

test("composeDraft() clicks compose and fills to/subject/body without sending", async () => {
	setGmailComposeDom();

	let ctrlEnterFired = 0;
	document.addEventListener("keydown", (e) => {
		if (e.ctrlKey && e.key === "Enter") ctrlEnterFired++;
	});

	await googleAdapter.composeDraft({
		to: ["a@example.com", "b@example.com"],
		subject: "Hello there",
		body: "This is the draft body.",
	});

	const to = document.querySelector<HTMLInputElement>('[name="to"]');
	const subject = document.querySelector<HTMLInputElement>('input[name="subjectbox"]');
	const body = document.querySelector('[g_editable="true"]');

	expect(to?.value).toBe("a@example.com, b@example.com");
	expect(subject?.value).toBe("Hello there");
	expect(body?.textContent).toBe("This is the draft body.");
	expect(ctrlEnterFired).toBe(0);
});

test("composeDraft() throws instead of navigating when called outside Gmail", async () => {
	window.happyDOM.setURL("https://example.com/");
	await expect(
		googleAdapter.composeDraft({ to: ["a@example.com"], subject: "s", body: "b" }),
	).rejects.toThrow();
});

test("sendDraft() dispatches Ctrl+Enter on the open compose body and only when called explicitly", async () => {
	setGmailComposeDom();
	let ctrlEnterFired = 0;
	document.addEventListener("keydown", (e) => {
		if (e.ctrlKey && e.key === "Enter") ctrlEnterFired++;
	});

	await googleAdapter.sendDraft();
	expect(ctrlEnterFired).toBe(1);
});

test("discardDraft() dispatches Ctrl+Shift+D on the open compose dialog", async () => {
	setGmailComposeDom();
	let discardFired = 0;
	document.addEventListener("keydown", (e) => {
		if (e.ctrlKey && e.shiftKey && e.key === "D") discardFired++;
	});

	await googleAdapter.discardDraft();
	expect(discardFired).toBe(1);
});

test("createEvent() opens the quick-create dialog via 'c' and fills the title without saving", async () => {
	window.happyDOM.setURL("https://calendar.google.com/calendar/u/0/r");
	document.body.innerHTML = `<div role="dialog"><input type="text" /></div>`;

	let cPressed = 0;
	let ctrlSFired = 0;
	document.body.addEventListener("keydown", (e) => {
		if (e.key === "c") cPressed++;
	});
	document.addEventListener("keydown", (e) => {
		if (e.ctrlKey && e.key === "s") ctrlSFired++;
	});

	await googleAdapter.createEvent({
		title: "Team meeting",
		start: "2026-09-01T10:00:00Z",
		end: "2026-09-01T10:30:00Z",
	});

	const titleField = document.querySelector<HTMLInputElement>('[role="dialog"] input[type="text"]');
	expect(cPressed).toBe(1);
	expect(titleField?.value).toBe("Team meeting");
	expect(ctrlSFired).toBe(0);
});

test("saveEvent() dispatches Ctrl+S on the open event dialog and only when called explicitly", async () => {
	window.happyDOM.setURL("https://calendar.google.com/calendar/u/0/r");
	document.body.innerHTML = `<div role="dialog"><input type="text" /></div>`;
	let ctrlSFired = 0;
	document.addEventListener("keydown", (e) => {
		if (e.ctrlKey && e.key === "s") ctrlSFired++;
	});

	await googleAdapter.saveEvent();
	expect(ctrlSFired).toBe(1);
});
