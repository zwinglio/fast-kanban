import { Hono } from "hono";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { authenticateAgent } from "./agent.js";
import { createMcpServer } from "../mcp/tools.js";

export function mcpRoutes(agent: Hono<any>): Hono {
  const routes = new Hono();

  routes.all("/:boardId", async (c) => {
    const boardId = c.req.param("boardId");
    const authorization = c.req.header("Authorization");
    const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1].trim();
    const access = await authenticateAgent(boardId, token);
    if (!access.ok) return c.json({ error: access.error }, access.status);

    const client = async (method: string, path: string, body?: unknown) => {
      const response = await agent.request(`/boards/${boardId}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      return { status: response.status, data: await response.json().catch(() => null) };
    };

    const server = createMcpServer(client);
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    await server.connect(transport);
    return transport.handleRequest(c.req.raw);
  });

  return routes;
}
