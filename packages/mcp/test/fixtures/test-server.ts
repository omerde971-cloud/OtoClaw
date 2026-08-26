#!/usr/bin/env bun
// Minimal stdio MCP server used only by this package's tests. Deterministic, no network.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
	name: "otoclaw-test-fixture",
	version: "0.0.0",
});

server.registerTool(
	"echo",
	{
		description: "Returns the given text unchanged.",
		inputSchema: { text: z.string() },
	},
	async ({ text }) => ({ content: [{ type: "text", text }] }),
);

server.registerTool(
	"add",
	{
		description: "Adds two numbers.",
		inputSchema: { a: z.number(), b: z.number() },
	},
	async ({ a, b }) => ({ content: [{ type: "text", text: String(a + b) }] }),
);

await server.connect(new StdioServerTransport());
