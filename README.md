# Fast Kanban

A lightweight Kanban tool for tracking fast project roadmaps. Create a board and get a random shareable
URL; each board has a custom prefix so its cards get human IDs like `PROJ-1`, `PROJ-2`. Boards are
**view-open** (anyone with the link can read) but **edit-protected** by a one-time edit key shown to the
creator.

## Tech stack

- **Frontend:** Vue 3 (`<script setup>`) + Vite + vue-router, `vuedraggable` for drag-and-drop columns,
  `markdown-it` + `DOMPurify` for sanitized Markdown card bodies.
- **Backend:** [Hono](https://hono.dev) served via `@hono/node-server` — portable across Node and Bun.
- **Database:** MySQL/MariaDB via Prisma.
- **Auth:** per-board edit key, hashed with Node's built-in `crypto.scrypt` (no native deps).

Local dev uses **Bun** as the package manager/runner; **production runs on plain Node** (e.g. a CloudPanel
Node site). The server code intentionally avoids Bun-only APIs (`Bun.serve`, `Bun.password`, ...) so the
same code runs unmodified on both.

## Project structure

```
prisma/schema.prisma   # Board / Card data model
server/                # Hono API (db.ts, auth.ts, routes/boards.ts, routes/cards.ts, index.ts)
src/                   # Vue app (views, components, api.ts, lib/)
dist/                  # built SPA (after `bun run build`)
dist-server/           # bundled Node server (after `bun run build:server`)
```

## Local development

1. **Install dependencies**
   ```bash
   bun install
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   # edit .env: DATABASE_URL, PORT
   ```

3. **Provision the database** (needs a MariaDB/MySQL admin account once):
   ```sql
   CREATE DATABASE fast_kanban;
   CREATE USER 'kanban'@'localhost' IDENTIFIED BY '<password>';
   GRANT ALL PRIVILEGES ON fast_kanban.* TO 'kanban'@'localhost';
   FLUSH PRIVILEGES;
   ```
   Then run migrations:
   ```bash
   bun run db:migrate
   ```
   > Note: `prisma migrate dev` creates a temporary shadow database, so the local dev user needs
   > privileges to create/drop databases (not just `fast_kanban`). Scope this down for anything beyond
   > local dev.

4. **Run the app** (two processes):
   ```bash
   bun run server   # API on http://localhost:3001
   bun run dev      # Vite dev server on http://localhost:5173, proxies /api to the server
   ```
   Open `http://localhost:5173`.

## Building for production

```bash
bun run build          # builds the SPA into dist/
bun run build:server   # bundles server/index.ts into dist-server/index.js (Node target)
bun run db:generate    # regenerate the Prisma client (also runs automatically after db:migrate)
```

`dist-server/index.js` serves the API **and** the static `dist/` SPA when `NODE_ENV=production`, so a
single Node process is all you need in prod.

## Deploying to CloudPanel (Node site)

### One-time server setup

1. Create a Node site in CloudPanel and a MySQL database for it; note the DB credentials it gives you.
2. Set the site's **root directory** to this project's directory (the one containing `dist/`,
   `dist-server/`, `prisma/`, and `package.json`) — not `dist/` itself, since the Node process serves the
   SPA from `dist/` internally.
3. Set environment variables on the site: `DATABASE_URL` (pointing at the CloudPanel MySQL DB) and
   `NODE_ENV=production` (and `PORT` if CloudPanel requires a specific value — it usually injects one).
4. Set the **startup file** to `dist-server/index.js` (or configure the app's start command to
   `node dist-server/index.js`).
5. The app process is managed by **PM2** under the name `fast-kanban`.

### Automated deploy via GitHub Actions

Pushing to `main` triggers the CI/CD workflow (`.github/workflows/ci-cd.yml`) which:

1. **CI job** (runs on every push & PR): typecheck (`vue-tsc --noEmit`), `vite build`, and
   `bun build server` — if any of these fail the workflow stops.
2. **Deploy job** (runs only on push to `main` after CI passes): SSHs into the server, pulls latest,
   installs deps, runs Prisma migrations, builds frontend + server, and restarts PM2.

**Required GitHub repo secrets** (Settings → Secrets and variables → Actions):

| Secret | Description |
|---|---|
| `DEPLOY_HOST` | Server hostname/IP |
| `DEPLOY_USER` | SSH user for deploy |
| `DEPLOY_SSH_KEY` | Private key contents (see below) |
| `DEPLOY_PATH` | Absolute path to the project on the server (e.g. `/home/zwinglio-fast-kanban/htdocs/fast-kanban.zwinglio.com`) |
| `DEPLOY_PORT` | SSH port (optional, defaults to 22) |

**Generate a dedicated deploy key:**

```bash
ssh-keygen -t ed25519 -f deploy_key -N ""
```

Append `deploy_key.pub` to `~/.ssh/authorized_keys` on the server for the deploy user, then add the
contents of `deploy_key` (the private key) as the `DEPLOY_SSH_KEY` repo secret.

### Manual deploy (fallback)

If GitHub Actions / SSH is unavailable, SSH in and run:

```bash
cd <deploy-path>
git pull
bun install --omit=dev
bunx prisma generate
bunx prisma migrate deploy
bun run build
bun run build:server
pm2 restart fast-kanban
```

## API overview

Public:
- `POST /api/boards` — `{ title, prefix }` → `{ id, editKey }` (edit key shown once).
- `GET /api/boards/:id` — `{ board, cards }`.
- `GET /api/boards/:id/verify` — checks an `X-Edit-Key` header, returns `{ valid }`.

Edit-key protected (`X-Edit-Key` header):
- `POST /api/boards/:id/cards` — create a card (`seq` allocated atomically).
- `PATCH /api/cards/:id` — edit title/body/status/position (also used for drag-and-drop moves).
- `DELETE /api/cards/:id`.

See `AGENTS.md` for additional dev/verification notes.

## Agents & MCP

Each board exposes a token-protected agent API and a stateless remote MCP endpoint. The token is the board's existing edit key (the UI's **Agents & API** panel shows the locally saved key); it grants full edit access. Send it as `Authorization: Bearer <token>` or, for REST requests, `X-Edit-Key: <token>`.

REST base URL:

```text
/api/agent/boards/<boardId>
```

Available routes:

- `GET /` — board details and valid column, priority, and tag names.
- `GET /cards` — list cards; optional `column`, `priority`, `tag`, `q`, `archived=false|true|all`, and `limit` (default 100, max 500).
- `GET /cards/:key` — card details, dependencies, latest comments, and activity. Keys are `PREFIX-123` or a bare number.
- `POST /cards` — create a card; `PATCH /cards/:key` — update, move, archive, or restore it.
- `POST /cards/:key/comments` — add a comment.
- `POST /cards/:key/dependencies` with `{ "blocker": "PROJ-3" }` and `DELETE /cards/:key/dependencies/:blockerKey` — manage dependencies.

Columns, priorities, and tags are resolved by name, case-insensitively. Use `GET /` to discover the valid names. The agent API does not provide board configuration or card deletion.

Example:

```bash
curl -H "Authorization: Bearer <token>" \\
  "https://kanban.example.com/api/agent/boards/<boardId>/cards?q=release&archived=false"
```

### Remote MCP

The remote MCP endpoint is `/api/mcp/<boardId>` and accepts the standard Streamable HTTP protocol. Configure Claude Code:

```bash
claude mcp add --transport http fast-kanban \\
  https://kanban.example.com/api/mcp/<boardId> \\
  --header "Authorization: Bearer <token>"
```

A generic `mcpServers` entry is:

```json
{
  "mcpServers": {
    "fast-kanban": {
      "url": "https://kanban.example.com/api/mcp/<boardId>",
      "headers": { "Authorization": "Bearer <token>" }
    }
  }
}
```

### Local stdio MCP

Set the connection variables and run the standalone Node bundle (or use `bun run mcp` during development):

```bash
export FAST_KANBAN_URL="https://kanban.example.com"
export FAST_KANBAN_BOARD_ID="<boardId>"
export FAST_KANBAN_TOKEN="<token>"
# Optional comment author:
export FAST_KANBAN_AUTHOR="Automation"
node dist-mcp/fast-kanban-mcp.js
```

Build the standalone file with `bun run build:mcp`. It uses `fetch` to call the remote REST API and does not connect to the database. Keep the token private: it has the same permissions as the board edit key.
