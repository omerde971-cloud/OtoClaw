import { EventEmitter } from "node:events";
import type { AgentEventMap, AgentEventName, AgentEvents } from "./types";

export class NodeAgentEvents implements AgentEvents {
	private readonly emitter = new EventEmitter();

	emit<K extends AgentEventName>(event: K, payload: AgentEventMap[K]): void {
		this.emitter.emit(event, payload);
	}

	on<K extends AgentEventName>(event: K, listener: (payload: AgentEventMap[K]) => void): void {
		this.emitter.on(event, listener as (...args: unknown[]) => void);
	}

	off<K extends AgentEventName>(event: K, listener: (payload: AgentEventMap[K]) => void): void {
		this.emitter.off(event, listener as (...args: unknown[]) => void);
	}
}

export interface RecordedAgentEvent<K extends AgentEventName = AgentEventName> {
	event: K;
	payload: AgentEventMap[K];
}

/** In-memory sink for tests: records every emitted event in order, in addition to dispatching it. */
export class RecordingAgentEvents implements AgentEvents {
	readonly log: RecordedAgentEvent[] = [];
	private readonly inner = new NodeAgentEvents();

	emit<K extends AgentEventName>(event: K, payload: AgentEventMap[K]): void {
		this.log.push({ event, payload });
		this.inner.emit(event, payload);
	}

	on<K extends AgentEventName>(event: K, listener: (payload: AgentEventMap[K]) => void): void {
		this.inner.on(event, listener);
	}

	off<K extends AgentEventName>(event: K, listener: (payload: AgentEventMap[K]) => void): void {
		this.inner.off(event, listener);
	}

	stages(): string[] {
		return this.log.filter((e) => e.event === "pipeline.stage").map((e) => (e.payload as { stage: string }).stage);
	}
}
