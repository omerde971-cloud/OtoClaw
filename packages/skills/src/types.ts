import { z } from "zod";

export const SkillManifestSchema = z.object({
	name: z.string(),
	description: z.string(),
	triggers: z.array(z.string()),
	version: z.string(),
	source: z.string(),
	/** Reserved for a future phase — never read/executed in Phase 2c. */
	tools: z.array(z.string()).optional(),
});

export type SkillManifest = z.infer<typeof SkillManifestSchema>;

export interface Skill {
	manifest: SkillManifest;
	/** Contents of SKILL.md — the instructions the agent follows once the skill is loaded. */
	instructions: string;
}

export type SkillSource = "local" | "github";

export interface SkillCandidate {
	name: string;
	source: SkillSource;
	/** Where to fetch the skill from — a repo URL, local path, etc. Interpreted by the installer. */
	location: string;
	description?: string;
}
