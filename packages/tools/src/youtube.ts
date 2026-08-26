import type { Tool, ToolResult } from "./types";

const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

type YoutubeAction = "searchVideos" | "getVideoDetails" | "getChannelDetails";

interface YoutubeArgs {
	action: YoutubeAction;
	query?: string;
	videoId?: string;
	channelId?: string;
	maxResults?: number;
}

// biome-ignore lint/suspicious/noExplicitAny: raw pass-through of the YouTube Data API v3 JSON response.
type YoutubeValue = any;

export interface CreateYoutubeToolOptions {
	apiKey?: string;
	fetchImpl?: typeof fetch;
}

/** Read-only YouTube Data API v3 access (search, video/channel details) — no OAuth, key-based only. */
export function createYoutubeTool(opts: CreateYoutubeToolOptions = {}): Tool<YoutubeArgs, YoutubeValue> {
	const fetchImpl = opts.fetchImpl ?? fetch;

	return {
		name: "youtube",
		description: "Search YouTube or fetch public video/channel details via the YouTube Data API v3 (read-only).",
		permissionKey: "web.fetch",
		schema: {
			type: "object",
			properties: {
				action: { type: "string", enum: ["searchVideos", "getVideoDetails", "getChannelDetails"] },
				query: { type: "string" },
				videoId: { type: "string" },
				channelId: { type: "string" },
				maxResults: { type: "number" },
			},
			required: ["action"],
		},
		async run(args): Promise<ToolResult<YoutubeValue>> {
			if (!opts.apiKey) {
				return { ok: false, error: "no YouTube API key configured" };
			}

			let url: URL;
			switch (args.action) {
				case "searchVideos": {
					if (!args.query?.trim()) {
						return { ok: false, error: "query is required for searchVideos" };
					}
					url = new URL(`${YOUTUBE_API_BASE}/search`);
					url.searchParams.set("part", "snippet");
					url.searchParams.set("type", "video");
					url.searchParams.set("q", args.query);
					url.searchParams.set("maxResults", String(args.maxResults ?? 10));
					break;
				}
				case "getVideoDetails": {
					if (!args.videoId?.trim()) {
						return { ok: false, error: "videoId is required for getVideoDetails" };
					}
					url = new URL(`${YOUTUBE_API_BASE}/videos`);
					url.searchParams.set("part", "snippet,contentDetails,statistics");
					url.searchParams.set("id", args.videoId);
					break;
				}
				case "getChannelDetails": {
					if (!args.channelId?.trim()) {
						return { ok: false, error: "channelId is required for getChannelDetails" };
					}
					url = new URL(`${YOUTUBE_API_BASE}/channels`);
					url.searchParams.set("part", "snippet,contentDetails,statistics");
					url.searchParams.set("id", args.channelId);
					break;
				}
				default:
					return { ok: false, error: `unsupported action: ${args.action as string}` };
			}
			url.searchParams.set("key", opts.apiKey);

			try {
				const response = await fetchImpl(url.toString());
				const body = await response.json().catch(() => undefined);
				if (!response.ok) {
					const message =
						(body as { error?: { message?: string } } | undefined)?.error?.message ?? `HTTP ${response.status}`;
					return { ok: false, error: message };
				}
				return { ok: true, value: body };
			} catch (err) {
				return { ok: false, error: err instanceof Error ? err.message : String(err) };
			}
		},
	};
}
