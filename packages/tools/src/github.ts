import type { Tool, ToolResult } from "./types";

const GITHUB_API_BASE = "https://api.github.com";

interface GithubArgs {
	action: "listIssues" | "createIssue" | "getPullRequest" | "listPullRequests";
	owner: string;
	repo: string;
	issueNumber?: number;
	title?: string;
	body?: string;
	pullNumber?: number;
}

interface GithubIssue {
	number: number;
	title: string;
	state: string;
	body: string | null;
	html_url: string;
}

interface GithubPullRequest {
	number: number;
	title: string;
	state: string;
	body: string | null;
	html_url: string;
	merged: boolean;
}

type GithubValue = GithubIssue | GithubIssue[] | GithubPullRequest | GithubPullRequest[];

interface GithubOpts {
	token?: string;
	fetchImpl?: typeof fetch;
}

function requestInit(token: string, method: string, body?: unknown): RequestInit {
	return {
		method,
		headers: {
			Authorization: `Bearer ${token}`,
			Accept: "application/vnd.github+json",
			...(body !== undefined ? { "Content-Type": "application/json" } : {}),
		},
		...(body !== undefined ? { body: JSON.stringify(body) } : {}),
	};
}

async function githubRequest(
	fetchImpl: typeof fetch,
	token: string,
	path: string,
	method: string,
	body?: unknown,
): Promise<ToolResult<GithubValue>> {
	let response: Response;
	try {
		response = await fetchImpl(`${GITHUB_API_BASE}${path}`, requestInit(token, method, body));
	} catch (err) {
		return { ok: false, error: err instanceof Error ? err.message : String(err) };
	}

	if (!response.ok) {
		let message = response.statusText;
		try {
			const errorBody = (await response.json()) as { message?: string };
			if (errorBody?.message) message = errorBody.message;
		} catch {
			// non-JSON error body, fall back to statusText
		}
		return { ok: false, error: `${response.status}: ${message}` };
	}

	try {
		const value = (await response.json()) as GithubValue;
		return { ok: true, value };
	} catch (err) {
		return { ok: false, error: err instanceof Error ? err.message : String(err) };
	}
}

export function createGithubTool(opts: GithubOpts = {}): Tool<GithubArgs, GithubValue> {
	const fetchImpl = opts.fetchImpl ?? fetch;

	return {
		name: "github",
		description: "Interact with the GitHub REST API: list/create issues, list/get pull requests.",
		permissionKey: "github",
		schema: {
			type: "object",
			properties: {
				action: { type: "string", enum: ["listIssues", "createIssue", "getPullRequest", "listPullRequests"] },
				owner: { type: "string" },
				repo: { type: "string" },
				issueNumber: { type: "number" },
				title: { type: "string" },
				body: { type: "string" },
				pullNumber: { type: "number" },
			},
			required: ["action", "owner", "repo"],
		},
		async run(args): Promise<ToolResult<GithubValue>> {
			const token = opts.token;
			if (!token) {
				return { ok: false, error: "no GitHub token configured" };
			}

			const { action, owner, repo } = args;
			switch (action) {
				case "listIssues":
					return githubRequest(fetchImpl, token, `/repos/${owner}/${repo}/issues`, "GET");
				case "createIssue":
					if (!args.title) {
						return { ok: false, error: "title is required for createIssue" };
					}
					return githubRequest(fetchImpl, token, `/repos/${owner}/${repo}/issues`, "POST", {
						title: args.title,
						body: args.body,
					});
				case "getPullRequest":
					if (args.pullNumber === undefined) {
						return { ok: false, error: "pullNumber is required for getPullRequest" };
					}
					return githubRequest(
						fetchImpl,
						token,
						`/repos/${owner}/${repo}/pulls/${args.pullNumber}`,
						"GET",
					);
				case "listPullRequests":
					return githubRequest(fetchImpl, token, `/repos/${owner}/${repo}/pulls`, "GET");
				default:
					return { ok: false, error: `unsupported action: ${action}` };
			}
		},
	};
}
