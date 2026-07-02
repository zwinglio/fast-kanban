# Fast Kanban — Dev Notes

## Stack
- Bun (local package manager/dev runner). **Production runtime is plain Node** — server code must avoid
  Bun-only APIs (`Bun.serve`, `Bun.password`, etc). Uses `@hono/node-server` + `node:crypto` scrypt instead.
- Vue 3 + Vite (frontend), Hono (API), Prisma + MySQL/MariaDB.

## Local setup
1. Copy `.env.example` to `.env` and set `DATABASE_URL` (MariaDB) and `PORT`.
2. `bun install`
3. `bun run db:migrate` — applies Prisma migrations (creates `boards`/`cards` tables).
4. `bun run server` — starts the API on `PORT` (default 3001) via Bun.
5. `bun run dev` — starts Vite dev server (default 5173), proxies `/api` to the backend port.

## Build / prod
- `bun run build` — builds the SPA to `dist/`.
- `bun run build:server` — bundles `server/index.ts` to `dist-server/index.js` targeting Node
  (`@prisma/client` kept external since it has native bindings).
- `bun run db:generate` — regenerate Prisma client (also run automatically after `db:migrate`).
- On CloudPanel (Node prod): set `DATABASE_URL` in the site env, run `npx prisma migrate deploy`,
  build both frontend and server, then `NODE_ENV=production node dist-server/index.js` (serves `dist/` + API).

## Verification
- Typecheck: `bunx vue-tsc --noEmit`
- Frontend build: `bunx vite build`
- Backend smoke test:
  ```
  curl -X POST localhost:3001/api/boards -H 'Content-Type: application/json' -d '{"title":"Demo","prefix":"PROJ"}'
  ```
  should return `{id, editKey}`. Card creation requires the `X-Edit-Key` header matching that board.
- No `Bun.*` APIs should appear under `server/` (checked via `grep -rn "Bun\." server/`).

## DB user note
Local dev DB user `kanban` was granted broad privileges (`GRANT ALL ON *.*`) so Prisma can create/drop
its shadow database during `migrate dev`. Scope this down (`GRANT ALL ON fast_kanban.*` only) for anything
beyond local dev, and use a dedicated least-privilege user in production.
