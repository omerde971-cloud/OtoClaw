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

export const ConfigSchema = z.object({
	mode: z.enum(["manual", "auto"]).default("manual"),
	permissions: z.record(z.string(), PermissionDecisionValueSchema).default({}),
	// Sandbox is a hard invariant in Auto mode (see permission/engine.ts); this only
	// selects sandbox depth, it can never disable sandboxing while mode === "auto".
	sandbox: z
		.object({
			auto: z.boolean().default(true),
		})
		.default({ auto: true }),
});

export type Config = z.infer<typeof ConfigSchema>;
