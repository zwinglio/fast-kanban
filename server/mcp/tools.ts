import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export type AgentClient = (
  method: string,
  path: string,
  body?: unknown
) => Promise<{ status: number; data: any }>;

type AgentClientWithAuthor = AgentClient & { defaultAuthor?: string };

const keyDescription = "Card keys look like PREFIX-123 (for example PROJ-1); a bare card number is also accepted.";
const namesDescription = "Use column, priority, and tag names; call get_board to see the valid names.";

export function createMcpServer(client: AgentClient): McpServer {
  const server = new McpServer({ name: "fast-kanban", version: "1.0.0" });
  const defaultAuthor = (client as AgentClientWithAuthor).defaultAuthor;

  server.registerTool(
    "get_board",
    {
      description: "Read board details and the available columns, priorities, and tags by name.",
      inputSchema: z.object({}),
    },
    () => call(client, "GET", "/")
  );

  server.registerTool(
    "list_cards",
    {
      description: `List cards with optional filters. ${keyDescription} ${namesDescription}`,
      inputSchema: z.object({
        column: z.string().optional().describe("Filter by exact column name; call get_board to see names."),
        priority: z.string().optional().describe("Filter by priority name; call get_board to see names."),
        tag: z.string().optional().describe("Filter by tag name; call get_board to see names."),
        query: z.string().optional().describe("Case-insensitive substring of the title or an exact card key."),
        archived: z.enum(["false", "true", "all"]).optional().describe("Choose active cards, archived cards, or both; defaults to false."),
        limit: z.number().int().min(1).max(500).optional().describe("Maximum cards to return, from 1 to 500; defaults to 100."),
      }),
    },
    ({ column, priority, tag, query, archived, limit }) => {
      const params = new URLSearchParams();
      if (column !== undefined) params.set("column", column);
      if (priority !== undefined) params.set("priority", priority);
      if (tag !== undefined) params.set("tag", tag);
      if (query !== undefined) params.set("q", query);
      if (archived !== undefined) params.set("archived", archived);
      if (limit !== undefined) params.set("limit", String(limit));
      const encoded = params.toString();
      const suffix = encoded ? `?${encoded}` : "";
      return call(client, "GET", `/cards${suffix}`);
    }
  );

  server.registerTool(
    "get_card",
    {
      description: `Read a card with its body, dependencies, recent comments, and activity. ${keyDescription}`,
      inputSchema: z.object({ key: z.string().describe("Card key, e.g. PROJ-12, or a bare card number.") }),
    },
    ({ key }) => call(client, "GET", `/cards/${encodeURIComponent(key)}`)
  );

  server.registerTool(
    "create_card",
    {
      description: `Create a card. ${namesDescription}`,
      inputSchema: z.object({
        title: z.string().describe("Card title."),
        body: z.string().optional().describe("Markdown card body."),
        column: z.string().optional().describe("Column name; defaults to the first column."),
        priority: z.string().optional().describe("Priority name."),
        tags: z.array(z.string()).optional().describe("Existing tag names; unknown tags are rejected."),
        points: z.number().int().nullable().optional().describe("Story points, or null for no estimate."),
      }),
    },
    ({ title, body, column, priority, tags, points }) =>
      call(client, "POST", "/cards", { title, body, column, priority, tags, points })
  );

  server.registerTool(
    "update_card",
    {
      description: `Update card fields or archive/restore it. ${keyDescription} ${namesDescription}`,
      inputSchema: z.object({
        key: z.string().describe("Card key, e.g. PROJ-12, or a bare card number."),
        title: z.string().optional(),
        body: z.string().nullable().optional(),
        column: z.string().optional().describe("Column name; a changed column moves the card to the bottom."),
        priority: z.string().nullable().optional().describe("Priority name, or null to clear."),
        tags: z.array(z.string()).optional().describe("Replace tags with these existing tag names."),
        points: z.number().int().nullable().optional().describe("Story points, or null to clear."),
        archived: z.boolean().optional().describe("Set true to archive, false to restore."),
      }),
    },
    ({ key, ...body }) => call(client, "PATCH", `/cards/${encodeURIComponent(key)}`, body)
  );

  server.registerTool(
    "move_card",
    {
      description: `Move a card to the bottom of a column. ${keyDescription} ${namesDescription}`,
      inputSchema: z.object({
        key: z.string().describe("Card key, e.g. PROJ-12, or a bare card number."),
        column: z.string().describe("Destination column name; call get_board to see names."),
      }),
    },
    ({ key, column }) => call(client, "PATCH", `/cards/${encodeURIComponent(key)}`, { column })
  );

  server.registerTool(
    "add_comment",
    {
      description: `Add a comment to a card. ${keyDescription}`,
      inputSchema: z.object({
        key: z.string().describe("Card key, e.g. PROJ-12, or a bare card number."),
        body: z.string().describe("Comment text in Markdown."),
        author: z.string().optional().describe("Optional comment author; defaults to the configured stdio author, if any."),
      }),
    },
    ({ key, body, author }) => {
      const resolvedAuthor = author === undefined ? defaultAuthor : author;
      return call(client, "POST", `/cards/${encodeURIComponent(key)}/comments`, {
        body,
        ...(resolvedAuthor === undefined ? {} : { author: resolvedAuthor }),
      });
    }
  );

  server.registerTool(
    "add_dependency",
    {
      description: `Mark one card as blocked by another. ${keyDescription}`,
      inputSchema: z.object({
        key: z.string().describe("The blocked card key, e.g. PROJ-12."),
        blocker: z.string().describe("The blocking card key, e.g. PROJ-3."),
      }),
    },
    ({ key, blocker }) => call(client, "POST", `/cards/${encodeURIComponent(key)}/dependencies`, { blocker })
  );

  server.registerTool(
    "remove_dependency",
    {
      description: `Remove a blocker from a card. ${keyDescription}`,
      inputSchema: z.object({
        key: z.string().describe("The blocked card key, e.g. PROJ-12."),
        blocker: z.string().describe("The blocking card key, e.g. PROJ-3."),
      }),
    },
    ({ key, blocker }) =>
      call(client, "DELETE", `/cards/${encodeURIComponent(key)}/dependencies/${encodeURIComponent(blocker)}`)
  );

  return server;
}

async function call(client: AgentClient, method: string, path: string, body?: unknown) {
  try {
    const response = await client(method, path, body);
    if (response.status < 200 || response.status >= 300) {
      const message = typeof response.data?.error === "string"
        ? response.data.error
        : JSON.stringify(response.data, null, 2) ?? `HTTP ${response.status}`;
      return { content: [{ type: "text" as const, text: message }], isError: true };
    }
    return { content: [{ type: "text" as const, text: JSON.stringify(response.data, null, 2) ?? "null" }] };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { content: [{ type: "text" as const, text: message }], isError: true };
  }
}
