import { z } from "zod";

export const DaemonRuntimeInfoSchema = z.object({
	port: z.number(),
	token: z.string(),
	pid: z.number(),
	startedAt: z.string(),
});

export type DaemonRuntimeInfo = z.infer<typeof DaemonRuntimeInfoSchema>;

export const ConfigSchema = z.object({
	mode: z.enum(["manual", "auto"]).default("manual"),
});

export type Config = z.infer<typeof ConfigSchema>;
