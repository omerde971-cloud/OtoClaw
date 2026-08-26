import { z } from "zod";

export const DaemonRuntimeInfoSchema = z.object({
	port: z.number(),
	token: z.string(),
	pid: z.number(),
	startedAt: z.string(),
});

export type DaemonRuntimeInfo = z.infer<typeof DaemonRuntimeInfoSchema>;

export const PermissionDecisionValueSchema = z.enum(["allow", "ask", "deny", "always", "never"]);

export type PermissionDecisionValue = z.infer<typeof PermissionDecisionValueSchema>;

// .otoclaw/policy.json (per-project). See ARCHITECTURE.md §8.
export const PolicySchema = z.object({
	shell: PermissionDecisionValueSchema.default("ask"),
	"shell.allow": z.array(z.string()).default([]),
	"shell.deny": z.array(z.string()).default([]),
	"fs.write": PermissionDecisionValueSchema.default("ask"),
	"web.fetch": PermissionDecisionValueSchema.default("ask"),
});

export type Policy = z.infer<typeof PolicySchema>;

// Configured MCP server (ARCHITECTURE.md §12). `command`/`args` apply to the "stdio"
// transport; `url` applies to "http". Validated further at connect time.
export const McpServerConfigSchema = z.object({
	name: z.string(),
	transport: z.enum(["stdio", "http"]),
	command: z.string().optional(),
	args: z.array(z.string()).default([]),
	url: z.string().optional(),
});

export type McpServerConfig = z.infer<typeof McpServerConfigSchema>;

export const ConfigSchema = z.object({
	mode: z.enum(["manual", "auto"]).default("manual"),
	model: z.string().optional(),
	permissions: z.record(z.string(), PermissionDecisionValueSchema).default({}),
	// Sandbox is a hard invariant in Auto mode (see permission/engine.ts); this only
	// selects sandbox depth, it can never disable sandboxing while mode === "auto".
	sandbox: z
		.object({
			auto: z.boolean().default(true),
		})
		.default({ auto: true }),
	mcpServers: z.array(McpServerConfigSchema).default([]),
	// Phase 2e — off by default; when off, judge() keeps its Phase 2b single-judge behavior as-is.
	judgeCouncil: z
		.object({
			enabled: z.boolean(),
			lenses: z.array(z.string()),
		})
		.default({ enabled: false, lenses: ["correctness", "functional", "aesthetics"] }),
});

export type Config = z.infer<typeof ConfigSchema>;
