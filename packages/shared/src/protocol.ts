export interface JsonRpcRequest<
	TMethod extends string = string,
	TParams = unknown,
> {
	jsonrpc: "2.0";
	id: number | string;
	method: TMethod;
	params: TParams;
}

export interface JsonRpcResponse<TResult = unknown> {
	jsonrpc: "2.0";
	id: number | string;
	result?: TResult;
	error?: JsonRpcError;
}

export interface JsonRpcError {
	code: number;
	message: string;
	data?: unknown;
}

export interface JsonRpcNotification<
	TMethod extends string = string,
	TParams = unknown,
> {
	jsonrpc: "2.0";
	method: TMethod;
	params: TParams;
}

export interface SessionCreateParams {
	cwd: string;
	mode: "manual" | "auto";
}

export interface SessionCreateResult {
	sessionId: string;
}

export interface EchoSendParams {
	sessionId: string;
	message: string;
}

export interface EchoSendResult {
	ok: true;
}

export interface EchoEventPayload {
	sessionId: string;
	message: string;
	ts: string;
}

export type SessionCreateRequest = JsonRpcRequest<
	"session.create",
	SessionCreateParams
>;
export type EchoSendRequest = JsonRpcRequest<"echo.send", EchoSendParams>;

export type EchoNotification = JsonRpcNotification<"echo", EchoEventPayload>;
