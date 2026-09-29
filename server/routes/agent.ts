import type { Board } from "@prisma/client";
import { Hono, type Context, type Next } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { verifyEditKey } from "../auth.js";
import { prisma } from "../db.js";

type AgentEnv = {
  Variables: {
    agentToken: string;
    board: Board;
  };
};

type AuthCheck =
  | { ok: true; board: Board }
  | { ok: false; status: 401 | 404; error: string };

type AgentResponse = { status: number; data: any };

export function agentTokenFromHeaders(headers: Headers): string | undefined {
  const authorization = headers.get("Authorization");
  const bearer = authorization?.match(/^Bearer\s+(.+)$/i)?.[1].trim();
  return bearer || headers.get("X-Edit-Key")?.trim() || undefined;
}

export async function authenticateAgent(boardId: string, token: string | undefined): Promise<AuthCheck> {
  if (!token) return { ok: false, status: 401, error: "Missing token" };
  const board = await prisma.board.findUnique({ where: { id: boardId } });
  if (!board) return { ok: false, status: 404, error: "Board not found" };
  if (!(await verifyEditKey(token, board.editHash))) {
    return { ok: false, status: 401, error: "Invalid token" };
  }
  return { ok: true, board };
}

export function agentRoutes(api: Hono): Hono<AgentEnv> {
  const agent = new Hono<AgentEnv>();
  const requireAgentToken = async (c: Context<AgentEnv>, next: Next) => {
    const boardId = c.req.param("boardId");
    if (!boardId) return c.json({ error: "Board not found" }, 404);
    const token = agentTokenFromHeaders(c.req.raw.headers);
    const result = await authenticateAgent(boardId, token);
    if (!result.ok) return c.json({ error: result.error }, result.status);
    c.set("board", result.board);
    c.set("agentToken", token!);
    await next();
  };

  agent.use("/boards/:boardId", requireAgentToken);
  agent.use("/boards/:boardId/*", requireAgentToken);

  const boardSummary = async (c: Context<AgentEnv>) => {
    const board = c.get("board");
    const [columns, priorities, tags] = await Promise.all([
      prisma.column.findMany({ where: { boardId: board.id }, orderBy: { position: "asc" } }),
      prisma.priority.findMany({ where: { boardId: board.id }, orderBy: [{ position: "asc" }, { id: "asc" }] }),
      prisma.tag.findMany({ where: { boardId: board.id }, orderBy: { name: "asc" } }),
    ]);
    const counts = await Promise.all(
      columns.map((column) => prisma.card.count({ where: { boardId: board.id, columnId: column.id, archivedAt: null } }))
    );
    return c.json({
      board: {
        id: board.id,
        title: board.title,
        prefix: board.prefix,
        pointsEnabled: board.pointsEnabled,
        dependenciesEnabled: board.dependenciesEnabled,
      },
      columns: columns.map((column, index) => ({ name: column.name, color: column.color, cardCount: counts[index] })),
      priorities: priorities.map((priority) => priority.name),
      tags: tags.map((tag) => tag.name),
    });
  };

  agent.get("/boards/:boardId", boardSummary);
  agent.get("/boards/:boardId/", boardSummary);

  agent.get("/boards/:boardId/cards", async (c) => {
    const board = c.get("board");
    const columns = await prisma.column.findMany({ where: { boardId: board.id }, orderBy: { position: "asc" } });
    const priorities = await prisma.priority.findMany({ where: { boardId: board.id }, orderBy: [{ position: "asc" }, { id: "asc" }] });
    const tags = await prisma.tag.findMany({ where: { boardId: board.id }, orderBy: { name: "asc" } });

    const columnName = c.req.query("column");
    const priorityName = c.req.query("priority");
    const tagName = c.req.query("tag");
    const column = columnName === undefined ? undefined : findName(columns, columnName);
    if (columnName !== undefined && !column) {
      return c.json({ error: unknownNameError("column", columnName, columns.map((item) => item.name)) }, 400);
    }
    const priority = priorityName === undefined ? undefined : findName(priorities, priorityName);
    if (priorityName !== undefined && !priority) {
      return c.json({ error: unknownNameError("priority", priorityName, priorities.map((item) => item.name)) }, 400);
    }
    const tag = tagName === undefined ? undefined : findName(tags, tagName);
    if (tagName !== undefined && !tag) {
      return c.json({ error: unknownNameError("tag", tagName, tags.map((item) => item.name)) }, 400);
    }

    const archivedParam = c.req.query("archived") ?? "false";
    if (archivedParam !== "false" && archivedParam !== "true" && archivedParam !== "all") {
      return c.json({ error: 'archived must be "false", "true", or "all"' }, 400);
    }
    const limitParam = c.req.query("limit");
    const parsedLimit = limitParam === undefined ? 100 : Number(limitParam);
    if (!Number.isInteger(parsedLimit) || parsedLimit < 1) return c.json({ error: "Invalid limit" }, 400);
    const limit = Math.min(parsedLimit, 500);

    const cards = await prisma.card.findMany({
      where: {
        boardId: board.id,
        ...(column ? { columnId: column.id } : {}),
        ...(priorityName === undefined ? {} : { priorityId: priority?.id }),
        ...(tag ? { tags: { some: { id: tag.id } } } : {}),
        ...(archivedParam === "all" ? {} : { archivedAt: archivedParam === "true" ? { not: null } : null }),
      },
      orderBy: [{ column: { position: "asc" } }, { position: "asc" }],
      include: {
        column: { select: { name: true } },
        priority: { select: { name: true } },
        tags: { select: { name: true } },
        blockedBy: { include: { blocker: { select: { seq: true } } } },
        _count: { select: { comments: true } },
      },
    });
    const query = c.req.query("q")?.trim().toLowerCase();
    const matched = query
      ? cards.filter((card) => {
          const key = `${board.prefix}-${card.seq}`.toLowerCase();
          return card.title.toLowerCase().includes(query) || key === query;
        })
      : cards;
    return c.json({ cards: matched.slice(0, limit).map((card) => compactCard(board.prefix, card)) });
  });

  agent.get("/boards/:boardId/cards/:key", async (c) => {
    const board = c.get("board");
    const resolved = await resolveCard(board, c.req.param("key"));
    if (!resolved.ok) return c.json({ error: resolved.error }, 404);
    const detail = await cardDetail(board, resolved.card.id);
    if (!detail) return c.json({ error: `Card ${resolved.key} not found` }, 404);
    return c.json(detail);
  });

  agent.post("/boards/:boardId/cards", async (c) => {
    const board = c.get("board");
    const body = await readObjectBody(c);
    if (!body) return c.json({ error: "Invalid body" }, 400);

    const column = body.column === undefined ? undefined : await resolveColumn(board.id, body.column);
    if (body.column !== undefined && !column) {
      const valid = await prisma.column.findMany({ where: { boardId: board.id }, orderBy: { position: "asc" }, select: { name: true } });
      return c.json({ error: unknownNameError("column", String(body.column), valid.map((item) => item.name)) }, 400);
    }
    const priorityId = body.priority === undefined || body.priority === null
      ? null
      : await resolvePriorityId(board.id, body.priority);
    if (body.priority !== undefined && body.priority !== null && priorityId === null) {
      const valid = await prisma.priority.findMany({ where: { boardId: board.id }, orderBy: [{ position: "asc" }, { id: "asc" }], select: { name: true } });
      return c.json({ error: unknownNameError("priority", String(body.priority), valid.map((item) => item.name)) }, 400);
    }
    const tagIds = body.tags === undefined
      ? { ok: true as const, ids: [] }
      : await resolveTagIds(board.id, body.tags);
    if (!tagIds.ok) return c.json({ error: tagIds.error }, 400);

    const result = await dispatchWrite(api, board, c.get("agentToken"), "POST", `/boards/${board.id}/cards`, {
      title: body.title,
      ...(body.body !== undefined ? { body: body.body } : {}),
      ...(column ? { columnId: column.id } : {}),
      ...(body.priority !== undefined ? { priorityId } : {}),
      ...(body.points !== undefined ? { points: body.points } : {}),
      ...(body.tags !== undefined ? { tagIds: tagIds.ids } : {}),
    });
    if (result.status < 200 || result.status >= 300) return c.json(result.data, result.status as ContentfulStatusCode);
    const detail = await cardDetail(board, Number(result.data?.id));
    return c.json(detail, 201);
  });

  agent.patch("/boards/:boardId/cards/:key", async (c) => {
    const board = c.get("board");
    const token = c.get("agentToken");
    const body = await readObjectBody(c);
    if (!body) return c.json({ error: "Invalid body" }, 400);

    const resolved = await resolveCard(board, c.req.param("key"));
    if (!resolved.ok) return c.json({ error: resolved.error }, 404);
    const patch: Record<string, unknown> = {};

    if (body.column !== undefined) {
      const column = await resolveColumn(board.id, body.column);
      if (!column) {
        const valid = await prisma.column.findMany({ where: { boardId: board.id }, orderBy: { position: "asc" }, select: { name: true } });
        return c.json({ error: unknownNameError("column", String(body.column), valid.map((item) => item.name)) }, 400);
      }
      if (column.id !== resolved.card.columnId) {
        const last = await prisma.card.findFirst({
          where: { boardId: board.id, columnId: column.id, archivedAt: null },
          orderBy: { position: "desc" },
          select: { position: true },
        });
        patch.position = (last?.position ?? -1) + 1;
      }
      patch.columnId = column.id;
    }
    if (body.priority !== undefined) {
      if (body.priority === null) {
        patch.priorityId = null;
      } else {
        const priorityId = await resolvePriorityId(board.id, body.priority);
        if (priorityId === null) {
          const valid = await prisma.priority.findMany({ where: { boardId: board.id }, orderBy: [{ position: "asc" }, { id: "asc" }], select: { name: true } });
          return c.json({ error: unknownNameError("priority", String(body.priority), valid.map((item) => item.name)) }, 400);
        }
        patch.priorityId = priorityId;
      }
    }
    if (body.tags !== undefined) {
      const tagIds = await resolveTagIds(board.id, body.tags);
      if (!tagIds.ok) return c.json({ error: tagIds.error }, 400);
      patch.tagIds = tagIds.ids;
    }
    for (const field of ["title", "body", "points", "archived"] as const) {
      if (body[field] !== undefined) patch[field] = body[field];
    }
    if (Object.keys(patch).length === 0) return c.json({ error: "Empty patch" }, 400);

    const result = await dispatchWrite(api, board, token, "PATCH", `/cards/${resolved.card.id}`, patch);
    if (result.status < 200 || result.status >= 300) return c.json(result.data, result.status as ContentfulStatusCode);
    const detail = await cardDetail(board, resolved.card.id);
    return c.json(detail);
  });

  agent.post("/boards/:boardId/cards/:key/comments", async (c) => {
    const board = c.get("board");
    const resolved = await resolveCard(board, c.req.param("key"));
    if (!resolved.ok) return c.json({ error: resolved.error }, 404);
    const body = await readObjectBody(c);
    if (!body) return c.json({ error: "Invalid body" }, 400);
    const result = await dispatchWrite(api, board, c.get("agentToken"), "POST", `/cards/${resolved.card.id}/comments`, {
      body: body.body,
      ...(body.author !== undefined ? { author: body.author } : {}),
    });
    return c.json(result.data, result.status as ContentfulStatusCode);
  });

  agent.post("/boards/:boardId/cards/:key/dependencies", async (c) => {
    const board = c.get("board");
    const resolved = await resolveCard(board, c.req.param("key"));
    if (!resolved.ok) return c.json({ error: resolved.error }, 404);
    const body = await readObjectBody(c);
    if (!body) return c.json({ error: "Invalid body" }, 400);
    const blocker = await resolveCard(board, body.blocker);
    if (!blocker.ok) return c.json({ error: blocker.error }, 404);
    const result = await dispatchWrite(api, board, c.get("agentToken"), "POST", `/cards/${resolved.card.id}/dependencies`, {
      blockerId: blocker.card.id,
    });
    if (result.status < 200 || result.status >= 300) return c.json(result.data, result.status as ContentfulStatusCode);
    return c.json({ blocked: resolved.key, blocker: blocker.key }, 201);
  });

  agent.delete("/boards/:boardId/cards/:key/dependencies/:blockerKey", async (c) => {
    const board = c.get("board");
    const resolved = await resolveCard(board, c.req.param("key"));
    if (!resolved.ok) return c.json({ error: resolved.error }, 404);
    const blocker = await resolveCard(board, c.req.param("blockerKey"));
    if (!blocker.ok) return c.json({ error: blocker.error }, 404);
    const result = await dispatchWrite(
      api,
      board,
      c.get("agentToken"),
      "DELETE",
      `/cards/${resolved.card.id}/dependencies/${blocker.card.id}`
    );
    return c.json(result.data, result.status as ContentfulStatusCode);
  });

  return agent;
}

function findName<T extends { name: string }>(items: T[], name: string): T | undefined {
  return items.find((item) => item.name.toLowerCase() === name.toLowerCase());
}

function unknownNameError(kind: string, name: string, valid: string[]): string {
  return `Unknown ${kind} "${name}". Valid: ${valid.length ? valid.join(", ") : "(none)"}`;
}

async function resolveColumn(boardId: string, value: unknown) {
  if (typeof value !== "string") return null;
  const columns = await prisma.column.findMany({ where: { boardId }, orderBy: { position: "asc" } });
  return findName(columns, value);
}

async function resolvePriorityId(boardId: string, value: unknown): Promise<number | null> {
  if (typeof value !== "string") return null;
  const priorities = await prisma.priority.findMany({ where: { boardId }, orderBy: [{ position: "asc" }, { id: "asc" }] });
  return findName(priorities, value)?.id ?? null;
}

async function resolveTagIds(boardId: string, value: unknown): Promise<{ ok: true; ids: number[] } | { ok: false; error: string }> {
  if (!Array.isArray(value) || value.some((tag) => typeof tag !== "string")) {
    return { ok: false, error: "Tags must be an array of names" };
  }
  const tags = await prisma.tag.findMany({ where: { boardId }, orderBy: { name: "asc" } });
  const resolved = value.map((name) => findName(tags, name));
  const unknown = value.find((name, index) => !resolved[index]);
  if (unknown !== undefined) {
    return { ok: false, error: unknownNameError("tag", String(unknown), tags.map((tag) => tag.name)) };
  }
  return { ok: true, ids: resolved.map((tag) => tag!.id) };
}

function parseCardKey(board: Board, key: unknown): { seq: number; inputKey: string } | null {
  if (typeof key !== "string") return null;
  const value = key.trim();
  const bare = value.match(/^(\d+)$/);
  if (bare) return { seq: Number(bare[1]), inputKey: `${board.prefix}-${Number(bare[1])}` };
  const compound = value.match(/^([A-Z0-9]{1,16})-(\d+)$/i);
  if (!compound) return null;
  const prefix = compound[1].toUpperCase();
  const seq = Number(compound[2]);
  return { seq, inputKey: `${prefix}-${seq}` };
}

async function resolveCard(board: Board, value: unknown) {
  const parsed = parseCardKey(board, value);
  if (!parsed || parsed.seq < 1 || !Number.isSafeInteger(parsed.seq) || parsed.inputKey.split("-")[0] !== board.prefix) {
    const label = typeof value === "string" && value.trim() ? value.trim().toUpperCase() : String(value ?? "");
    return { ok: false as const, error: `Card ${label} not found` };
  }
  const card = await prisma.card.findUnique({ where: { boardId_seq: { boardId: board.id, seq: parsed.seq } } });
  if (!card) return { ok: false as const, error: `Card ${parsed.inputKey} not found` };
  return { ok: true as const, card, key: `${board.prefix}-${card.seq}` };
}

function compactCard(prefix: string, card: {
  seq: number;
  title: string;
  column: { name: string };
  priority: { name: string } | null;
  tags: { name: string }[];
  points: number | null;
  archivedAt: Date | null;
  blockedBy: { blocker: { seq: number } }[];
  _count: { comments: number };
  updatedAt: Date;
}) {
  return {
    key: `${prefix}-${card.seq}`,
    title: card.title,
    column: card.column.name,
    priority: card.priority?.name ?? null,
    tags: card.tags.map((tag) => tag.name),
    points: card.points,
    archived: Boolean(card.archivedAt),
    blockedBy: card.blockedBy.map((link) => `${prefix}-${link.blocker.seq}`),
    commentCount: card._count.comments,
    updatedAt: card.updatedAt,
  };
}

async function cardDetail(board: Board, cardId: number) {
  const card = await prisma.card.findFirst({
    where: { id: cardId, boardId: board.id },
    include: {
      column: { select: { name: true } },
      priority: { select: { name: true } },
      tags: { select: { name: true } },
      blocks: { include: { blocked: { select: { seq: true, title: true } } } },
      blockedBy: { include: { blocker: { select: { seq: true, title: true } } } },
      comments: { orderBy: { id: "desc" }, take: 20, select: { id: true, author: true, body: true, createdAt: true } },
      events: { orderBy: { id: "desc" }, take: 20, select: { type: true, data: true, createdAt: true } },
      _count: { select: { comments: true } },
    },
  });
  if (!card) return null;
  return {
    key: `${board.prefix}-${card.seq}`,
    title: card.title,
    column: card.column.name,
    priority: card.priority?.name ?? null,
    tags: card.tags.map((tag) => tag.name),
    points: card.points,
    archived: Boolean(card.archivedAt),
    blockedBy: card.blockedBy.map((link) => ({ key: `${board.prefix}-${link.blocker.seq}`, title: link.blocker.title })),
    commentCount: card._count.comments,
    updatedAt: card.updatedAt,
    body: card.body,
    createdAt: card.createdAt,
    blocks: card.blocks.map((link) => ({ key: `${board.prefix}-${link.blocked.seq}`, title: link.blocked.title })),
    comments: card.comments.reverse(),
    activity: card.events,
  };
}

async function readObjectBody(c: { req: { json: () => Promise<unknown> } }): Promise<Record<string, any> | null> {
  const body = await c.req.json().catch(() => null);
  return body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, any> : null;
}

async function dispatchWrite(
  api: Hono,
  board: Board,
  token: string,
  method: string,
  path: string,
  body?: unknown
): Promise<AgentResponse> {
  const response = await api.request(path, {
    method,
    headers: {
      "X-Edit-Key": token,
      "X-Client-Id": "agent",
      "Content-Type": "application/json",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await response.json().catch(() => null);
  return { status: response.status, data };
}
