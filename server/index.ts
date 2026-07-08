import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { boards } from "./routes/boards.js";
import { cards } from "./routes/cards.js";
import { tags } from "./routes/tags.js";

const app = new Hono();

app.route("/api/boards", boards);
app.route("/api/cards", cards);
app.route("/api/tags", tags);

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
