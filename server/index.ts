import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { boards } from "./routes/boards.js";
import { cards } from "./routes/cards.js";
import { columns } from "./routes/columns.js";
import { tags } from "./routes/tags.js";
import { priorities } from "./routes/priorities.js";
import { comments } from "./routes/comments.js";
import { agentRoutes } from "./routes/agent.js";
import { mcpRoutes } from "./routes/mcp.js";

const api = new Hono();
api.route("/boards", boards);
api.route("/cards", cards);
api.route("/columns", columns);
api.route("/tags", tags);
api.route("/priorities", priorities);
api.route("/comments", comments);

const agent = agentRoutes(api);
const app = new Hono();
app.route("/api", api);
app.route("/api/agent", agent);
app.route("/api/mcp", mcpRoutes(agent));

// Serve the built SPA. This bundled server is only ever run in production
// (local dev uses the Vite dev server instead), so no env-var gate is needed
// here — gating on process.env.NODE_ENV is unreliable since Bun's bundler
// inlines/dead-code-eliminates it based on the build-time environment.
const distRoot = `${process.cwd()}/dist`;
app.use("/*", serveStatic({ root: distRoot }));
app.get("/*", serveStatic({ path: `${distRoot}/index.html` }));

const port = Number(process.env.PORT) || 3001;

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`fast-kanban server listening on http://localhost:${info.port}`);
});
