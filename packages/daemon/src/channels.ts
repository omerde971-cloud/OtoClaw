import { randomUUID } from "node:crypto";
import type {
	PermissionChannel,
	PermissionRequest,
	QuestionAnswer,
	QuestionChannel,
	QuestionSpec,
} from "@otoclaw/agent";
import type { PermissionDecisionValue } from "@otoclaw/shared";
import type { SessionOverrides } from "@otoclaw/permission";

export type PermissionAnswerType = PermissionDecisionValue;

export interface PendingPermission {
	resolve: (decision: PermissionAnswerType) => void;
}

export interface PendingQuestion {
	resolve: (answer: QuestionAnswer) => void;
}

/**
 * Bridges agent/loop.ts's blocking PermissionChannel to a real WS round trip: emits
 * `permission.request` to the session's clients and resolves once `permission.respond`
 * arrives for the matching requestId.
 */
export class DaemonPermissionChannel implements PermissionChannel {
	constructor(
		private readonly sessionId: string,
		private readonly pending: Map<string, PendingPermission>,
		private readonly sessionOverrides: SessionOverrides,
		private readonly onRequest: (payload: { sessionId: string; requestId: string; tool: string; args: unknown; risk: PermissionRequest["risk"] }) => void,
	) {}

	async request(input: PermissionRequest): Promise<"allow" | "deny"> {
		const requestId = randomUUID();
		const decision = await new Promise<PermissionAnswerType>((resolve) => {
			this.pending.set(requestId, { resolve });
			this.onRequest({
				sessionId: this.sessionId,
				requestId,
				tool: input.toolName,
				args: input.args,
				risk: input.risk,
			});
		});

		if (decision === "always") this.sessionOverrides[input.toolName] = "allow";
		if (decision === "never") this.sessionOverrides[input.toolName] = "deny";

		return decision === "allow" || decision === "always" ? "allow" : "deny";
	}
}

/**
 * Bridges agent/loop.ts's blocking QuestionChannel to a real WS round trip: emits
 * `question.ask` and resolves once `question.respond` arrives for the matching questionId.
 */
export class DaemonQuestionChannel implements QuestionChannel {
	constructor(
		private readonly sessionId: string,
		private readonly pending: Map<string, PendingQuestion>,
		private readonly onAsk: (payload: { sessionId: string } & QuestionSpec) => void,
	) {}

	async ask(spec: QuestionSpec): Promise<QuestionAnswer> {
		return new Promise<QuestionAnswer>((resolve) => {
			this.pending.set(spec.questionId, { resolve });
			this.onAsk({ sessionId: this.sessionId, ...spec });
		});
	}
}
