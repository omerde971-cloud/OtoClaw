/**
 * API-less Google automation (ARCHITECTURE.md §14): drives the real signed-in Gmail/Calendar
 * session by reading and manipulating the DOM, no OAuth or API keys.
 *
 * Selector choices favor Gmail/Calendar's own automation-facing attributes (`gh`, `name`,
 * `g_editable`, `role`) and official keyboard shortcuts over `aria-label` text or class names,
 * which are localized or build-obfuscated and would break outside an English UI locale
 * (verified live against a Turkish-locale Gmail/Calendar account).
 *
 * Anything that would send an email or save a calendar event is deliberately NOT triggered by
 * this file — those are separate, uncalled methods (`sendDraft`, `discardDraft`, `saveEvent`)
 * so the caller can route them through OtoClaw's permission engine as their own approved
 * `browser.act` step instead of firing automatically inside `composeDraft`/`createEvent`.
 */

import { clickElement, findElement, typeInto, typeIntoEditable, waitForSelector } from "../content/dom-automation";
import { dispatchKeyCombo } from "../content/synthetic-events";

export interface ComposeDraftParams {
	to: string[];
	subject: string;
	body: string;
}

export interface CreateEventParams {
	title: string;
	start: string;
	end: string;
	attendees?: string[];
}

export interface EmailThread {
	threadId: string;
	subject: string;
	messages: Array<{ from: string; body: string; ts: string }>;
}

export interface InboxRow {
	summary: string;
	unread: boolean;
}

export interface GoogleAdapter {
	openInbox(): Promise<InboxRow[]>;
	readThread(threadId: string): Promise<EmailThread>;
	composeDraft(params: ComposeDraftParams): Promise<void>;
	/** Sends the currently open compose draft (Ctrl+Enter). Never called automatically. */
	sendDraft(): Promise<void>;
	/** Discards the currently open compose draft (Ctrl+Shift+D). Never called automatically. */
	discardDraft(): Promise<void>;
	createEvent(params: CreateEventParams): Promise<void>;
	/** Saves the event dialog opened by `createEvent`. Never called automatically. */
	saveEvent(): Promise<void>;
}

const GMAIL_ORIGIN = "https://mail.google.com/mail/u/0/";
const GMAIL_INBOX_URL = `${GMAIL_ORIGIN}#inbox`;
const CALENDAR_URL = "https://calendar.google.com/calendar/u/0/r";

// `gh="cm"` is Gmail's own automation hook for the compose button — stable across every UI
// locale, unlike its localized aria-label/tooltip text.
const COMPOSE_BUTTON = '[gh="cm"]';
// `name="to"`/`name="subjectbox"` are the real form field names Gmail submits, independent of
// the localized aria-label shown on screen ("Alıcılar" in Turkish, "To" in English, etc.).
const TO_FIELD = '[name="to"]';
const SUBJECT_FIELD = 'input[name="subjectbox"]';
// `g_editable="true"` marks Gmail's contenteditable compose body regardless of locale.
const BODY_FIELD = '[g_editable="true"]';
const COMPOSE_DIALOG = '[role="dialog"]';
const INBOX_ROW = 'tr[role="row"]';
const CALENDAR_EVENT_DIALOG = '[role="dialog"]';

function isGmail(): boolean {
	return typeof location !== "undefined" && location.hostname === "mail.google.com";
}

function isCalendar(): boolean {
	return typeof location !== "undefined" && location.hostname === "calendar.google.com";
}

function normalizeWhitespace(text: string): string {
	return text.replace(/\s+/g, " ").trim();
}

/** Gmail renders unread inbox rows in a heavier font weight — a style cue, not a locale string. */
function isUnreadRow(row: Element): boolean {
	const weight = getComputedStyle(row).fontWeight;
	const numeric = Number.parseInt(weight, 10);
	return weight === "bold" || (!Number.isNaN(numeric) && numeric >= 700);
}

export const googleAdapter: GoogleAdapter = {
	async openInbox() {
		if (!isGmail()) {
			location.href = GMAIL_INBOX_URL;
			return [];
		}
		await waitForSelector(INBOX_ROW);
		const rows = document.querySelectorAll(INBOX_ROW);
		return Array.from(rows).map((row) => ({
			summary: normalizeWhitespace(row.textContent ?? ""),
			unread: isUnreadRow(row),
		}));
	},

	async readThread(threadId: string) {
		if (!isGmail()) {
			throw new Error("readThread requires an open Gmail tab — call openInbox() first");
		}
		// Gmail is a single-page app: switching threads is a same-origin hash change, not a
		// full navigation, so `location.hash` (not `location.href`) is enough to route there.
		if (!location.hash.includes(threadId)) {
			location.hash = `#inbox/${threadId}`;
		}
		await waitForSelector('[role="listitem"]');

		const subjectEl = document.querySelector("h2");
		const subject = normalizeWhitespace(subjectEl?.textContent ?? "");

		const messageEls = document.querySelectorAll('[role="listitem"]');
		const messages = Array.from(messageEls).map((el) => {
			const senderEl = el.querySelector("[email]");
			const from = senderEl?.getAttribute("email") ?? normalizeWhitespace(senderEl?.textContent ?? "");
			const tsEl = el.querySelector("[title]");
			return {
				from,
				body: normalizeWhitespace(el.textContent ?? ""),
				ts: tsEl?.getAttribute("title") ?? "",
			};
		});

		return { threadId, subject, messages };
	},

	async composeDraft(params: ComposeDraftParams) {
		if (!isGmail()) {
			throw new Error("composeDraft requires an open Gmail tab — call openInbox() first");
		}
		const composeButton = await waitForSelector(COMPOSE_BUTTON);
		if (!composeButton) throw new Error("Gmail compose button not found");
		await clickElement(COMPOSE_BUTTON);

		const toField = await waitForSelector(TO_FIELD);
		if (!toField) throw new Error("Gmail 'to' field not found after opening compose");
		await typeInto(TO_FIELD, params.to.join(", "));
		await typeInto(SUBJECT_FIELD, params.subject);
		await typeIntoEditable(BODY_FIELD, params.body);
		// Deliberately stops here: no Ctrl+Enter, no submit. The draft is left open/saved by
		// Gmail's own autosave — sending is a separate, explicitly-invoked action (sendDraft).
	},

	async sendDraft() {
		const body = findElement(BODY_FIELD);
		if (!body) throw new Error("no open compose draft to send");
		// Gmail's official, locale-independent send shortcut.
		dispatchKeyCombo(body, "Enter", { ctrl: true });
	},

	async discardDraft() {
		const dialog = findElement(COMPOSE_DIALOG) ?? findElement(BODY_FIELD);
		if (!dialog) throw new Error("no open compose draft to discard");
		// Gmail's official, locale-independent discard-draft shortcut.
		dispatchKeyCombo(dialog, "D", { ctrl: true, shift: true });
	},

	async createEvent(params: CreateEventParams) {
		if (!isCalendar()) {
			location.href = CALENDAR_URL;
			return;
		}
		// Google Calendar's official, locale-independent "create event" shortcut — only works
		// when no input is focused, which holds here since this runs right after navigation.
		dispatchKeyCombo(document.body, "c");

		const dialog = await waitForSelector(CALENDAR_EVENT_DIALOG);
		if (!dialog) throw new Error("Calendar event dialog did not open after 'c' shortcut");

		const titleField = dialog.querySelector('input[type="text"]');
		if (!(titleField instanceof HTMLInputElement)) {
			throw new Error("Calendar event title field not found in dialog");
		}
		titleField.id ||= "otoclaw-calendar-title";
		await typeInto(`#${titleField.id}`, params.title);
		// Deliberately stops here: the event is NOT saved. Google's own title-field selector
		// for the quick-create dialog wasn't live-verified beyond opening it with 'c' (unlike
		// the Gmail selectors above), and saving/scheduling attendees is left as a separate,
		// explicitly-invoked, permission-gated action (saveEvent) rather than auto-submitted.
	},

	async saveEvent() {
		const dialog = findElement(CALENDAR_EVENT_DIALOG);
		if (!dialog) throw new Error("no open event dialog to save");
		// Ctrl+S is Calendar's official save-event shortcut inside the quick-create dialog.
		dispatchKeyCombo(dialog, "s", { ctrl: true });
	},
};
