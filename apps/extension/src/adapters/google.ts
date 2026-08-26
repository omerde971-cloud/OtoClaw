/**
 * API-less Google automation (ARCHITECTURE.md §14): drives the real signed-in Gmail/Calendar
 * session by reading and manipulating the DOM, no OAuth or API keys. Real selectors/flows are
 * a Phase 4 open question and land in a later sub-phase — this is the arrival interface only.
 */

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

export interface GoogleAdapter {
	openInbox(): Promise<void>;
	readThread(threadId: string): Promise<EmailThread>;
	composeDraft(params: ComposeDraftParams): Promise<void>;
	createEvent(params: CreateEventParams): Promise<void>;
}

export const googleAdapter: GoogleAdapter = {
	async openInbox() {
		throw new Error("not implemented — needs real Google DOM, Phase 4 open question");
	},
	async readThread(_threadId: string) {
		throw new Error("not implemented — needs real Google DOM, Phase 4 open question");
	},
	async composeDraft(_params: ComposeDraftParams) {
		throw new Error("not implemented — needs real Google DOM, Phase 4 open question");
	},
	async createEvent(_params: CreateEventParams) {
		throw new Error("not implemented — needs real Google DOM, Phase 4 open question");
	},
};
