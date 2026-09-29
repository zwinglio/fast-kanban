import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMcpServer, type AgentClient } from "./tools.js";

const required = ["FAST_KANBAN_URL", "FAST_KANBAN_BOARD_ID", "FAST_KANBAN_TOKEN"] as const;
const missing = required.filter((name) => !process.env[name]?.trim());

if (missing.length) {
  console.error(`Missing required environment variable${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}`);
  process.exitCode = 1;
} else {
  const baseUrl = process.env.FAST_KANBAN_URL!.replace(/\/$/, "");
  const boardId = process.env.FAST_KANBAN_BOARD_ID!;
  const token = process.env.FAST_KANBAN_TOKEN!;
  const author = process.env.FAST_KANBAN_AUTHOR?.trim() || undefined;

  const client = Object.assign(
    (async (method: string, path: string, body?: unknown) => {
      const response = await fetch(`${baseUrl}/api/agent/boards/${encodeURIComponent(boardId)}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      return { status: response.status, data: await response.json().catch(() => null) };
    }) satisfies AgentClient,
    { defaultAuthor: author }
  );

  const server = createMcpServer(client);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
