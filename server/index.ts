import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { boards } from "./routes/boards.js";
import { cards } from "./routes/cards.js";

const app = new Hono();

app.route("/api/boards", boards);
app.route("/api/cards", cards);

// Serve the built SPA in production.
if (process.env.NODE_ENV === "production") {
  app.use("/*", serveStatic({ root: "./dist" }));
  app.get("*", serveStatic({ path: "./dist/index.html" }));
}

const port = Number(process.env.PORT) || 3001;

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`fast-kanban server listening on http://localhost:${info.port}`);
});
