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
  The process is managed by **PM2** under the name `fast-kanban` — restart with `pm2 restart fast-kanban`.
- **Auto-deploy:** pushing to `main` triggers `.github/workflows/ci-cd.yml` — CI (typecheck + both builds)
  runs on every push/PR; deploy (SSH → pull → build → `pm2 restart`) runs only on push to `main` after CI
  passes. Required repo secrets: `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, `DEPLOY_PATH`
  (and `DEPLOY_PORT` if non-default). See README "Deploying to CloudPanel" for key setup.
- **Manual fallback** (when Actions/SSH is unavailable): SSH in, `git pull`, `bun install --omit=dev`,
  `bunx prisma generate`, `bunx prisma migrate deploy`, `bun run build`, `bun run build:server`,
  `pm2 restart fast-kanban`.

## Verification
- Typecheck: `./node_modules/.bin/vue-tsc --noEmit` with Node on `PATH`. Running vue-tsc under
  Bun alone ("bunx vue-tsc") silently skips `.vue` files, so it can miss SFC type errors that CI
  (`ubuntu-latest` with Node) will catch.
- Frontend build: `bunx vite build`
- Backend smoke test:
  ```
  curl -X POST localhost:3001/api/boards -H 'Content-Type: application/json' -d '{"title":"Demo","prefix":"PROJ"}'
  ```
  should return `{id, editKey}`. Card creation requires the `X-Edit-Key` header matching that board.
- No `Bun.*` APIs should appear under `server/` (checked via `grep -rn "Bun\." server/`).

## i18n
- UI messages live in `src/i18n/locales/en.ts` and `src/i18n/locales/pt-BR.ts` (typed TS objects, not
  JSON). **`en.ts` is the source of truth**: `MessageSchema` is `typeof en`, and `pt-BR.ts` is typed
  against it, so **every new UI string must be added to both files** — a missing or extra pt-BR key
  fails `bunx vue-tsc --noEmit`. Messages are namespaced by area (`common`, `home`, `board`, `header`,
  `filters`, `card`, `cardModal`, `comments`, `activity`, `dependencies`, `settings.*`, `table`,
  `errors`, `notFound`).
- Components use `<script setup>` + `const { t, d, n, locale } = useI18n()`; text, `aria-label`, `title`,
  `placeholder` and error refs must go through `t()`. Use named params (`t('home.seqRange', { max: n(MAX_SEQ, 'integer') })`)
  and vue-i18n pipe plurals (`"no cards | 1 card | {n} cards"`). Module-level arrays that carry UI labels
  (e.g. `DENSITIES`, `PALETTE`, `BOARD_ICONS`) store message keys (`labelKey`/`hintKey`) and render with
  `t(key)` so they react to a live language switch.
- Dates/numbers follow the active locale: `d(date, 'short' | 'medium' | 'long')`, `n(value, 'integer')`,
  or the helpers in `src/lib/formatTime.ts` (`relativeTime`, `shortDate`, `mediumDate`, `dateTime`).
- Locale detection/persistence is in `src/lib/locale.ts` (`fk_locale` in localStorage; Portuguese browsers
  default to pt-BR, everything else to en). `LanguageToggle.vue` switches live; `index.html` sets
  `<html lang>` before first paint. Adding another language = add `src/i18n/locales/<locale>.ts` typed
  against `MessageSchema`, register it in `src/i18n/index.ts` and `LOCALES` in `src/lib/locale.ts`.
- Server errors: respond with `fail(c, status, code, message, params?)` from `server/errors.ts`. Every
  error body keeps the English `error` (agents/curl/backward compatibility) and adds a stable `code`
  (plus `params` for interpolation when needed). The SPA maps `code` through the `errors.*` namespace in
  `apiErrorMessage(e)` (falling back to `error`), so **a new server code needs a matching `errors.<CODE>`
  entry in both locale files**. `server/routes/agent.ts` and MCP tools stay English.
- Board seed defaults are localized at creation: `defaultColumns(locale)` / `defaultPriorities(locale)`,
  with the locale read from `POST /api/boards` (`"en" | "pt-BR"`, default `"en"`). Existing boards are
  never rewritten.

## Agent and MCP API
- Agent REST routes live in `server/routes/agent.ts`; remote stateless MCP is in `server/routes/mcp.ts`, with shared tools in `server/mcp/tools.ts`.
- `bun run mcp` starts the local stdio MCP server using `FAST_KANBAN_URL`, `FAST_KANBAN_BOARD_ID`, and `FAST_KANBAN_TOKEN` (optional `FAST_KANBAN_AUTHOR`).
- `bun run build:mcp` bundles the standalone stdio client to `dist-mcp/fast-kanban-mcp.js`; it does not load Prisma.
- Agent API and MCP calls use the board's existing edit key as a Bearer token. The token grants full edit access.

## DB user note
Local dev DB user `kanban` was granted broad privileges (`GRANT ALL ON *.*`) so Prisma can create/drop
its shadow database during `migrate dev`. Scope this down (`GRANT ALL ON fast_kanban.*` only) for anything
beyond local dev, and use a dedicated least-privilege user in production.

<!-- trail:start -->
## Trail — repo context graph

This repo is indexed in `.trail/cache/`: small linked markdown nodes that explain each
system and carry exact file:line spans, kept in sync with the code through git.

For ANY task here — understanding how something works, finding where code lives,
or scoping a change — get context from the graph before grepping or opening
source files. Re-ask freely (it's cheap) and reuse literal identifiers you
already have (symbol, error string, file name) as the query. New to this repo?
Run `trail map` first — a token-budgeted orientation (dir clusters, hubs,
hotspots), no LLM, no key.

- Run `trail ask "<your question>" --source` → ranked nodes with the relevant
  code spans inlined (each hit's ≤8-line crux by default; `--full` for whole
  definitions when the crux isn't enough). Match the tool to the task shape:
  for understanding or editing, the top node IS the answer — cite its
  `covers:` file:line spans and edit straight from `--source`. For
  exhaustive tasks ("every occurrence / every caller of this pattern"), ranked
  results are top-N, not complete — run `trail grep "<literal>"` instead
  (exhaustive over indexed files, grouped by enclosing symbol), falling back
  to raw `grep -rn` only for unindexed files.
- `trail skeleton <file>` → every definition's signature + span, ~10× cheaper
  than reading the file; use it to skim an API surface.
- `trail callers <symbol>` gives precomputed, exact edges — who calls this.
  Add `--direction out` for what it calls, or `--depth N` to walk
  transitively for the full blast radius. For structural questions, skip
  ranking and use this directly.
- Or browse: `.trail/cache/INDEX.md` lists every node; follow the links.
- Monorepos and folders of multiple repos rank fairly across sub-projects —
  hits carry `[scope/]` labels naming which one they're from. Narrow with
  `trail ask "<task>" --in <scope>/` once you know where you're working.

If a returned span is truncated ("+N more lines"), open the file at that exact
range before finalizing. Only open source files when a node genuinely lacks a
needed detail, and then at the exact file:line the node points to — never
re-read whole files.

After big code changes, refresh the graph with `trail build` (deterministic,
no API key, $0).
<!-- trail:end -->
