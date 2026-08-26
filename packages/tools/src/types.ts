export interface ToolResult<T = unknown> {
	ok: boolean;
	value?: T;
	error?: string;
}

export interface ToolContext {
	cwd: string;
	sessionId: string;
}

// biome-ignore lint/suspicious/noExplicitAny: JSON Schema shape is intentionally open.
export type JsonSchema = Record<string, any>;

export interface Tool<Args = unknown, Value = unknown> {
	name: string;
	description: string;
	permissionKey: string;
	schema: JsonSchema;
	run(args: Args, ctx: ToolContext): Promise<ToolResult<Value>>;
}
