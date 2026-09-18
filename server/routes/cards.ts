import { Hono } from "hono";
import { prisma } from "../db.js";
import { verifyEditKey } from "../auth.js";
import { eventRows, type CardEventInput } from "../events.js";
import { MAX_POINTS, parsePoints } from "../points.js";

export const cards = new Hono();

async function requireCardEditKey(cardId: number, key: string | undefined) {
  if (!key) return { ok: false as const, status: 401 as const, error: "Missing edit key" };
  const card = await prisma.card.findUnique({ where: { id: cardId } });
  if (!card) return { ok: false as const, status: 404 as const, error: "Card not found" };
  const board = await prisma.board.findUnique({ where: { id: card.boardId } });
  if (!board) return { ok: false as const, status: 404 as const, error: "Board not found" };
  const valid = await verifyEditKey(key, board.editHash);
  if (!valid) return { ok: false as const, status: 401 as const, error: "Invalid edit key" };
  return { ok: true as const, card };
}

// GET /api/cards/:id/events?limit=4&before=<eventId> - newest-first activity (public, like the board)
cards.get("/:id/events", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id)) return c.json({ error: "Invalid card id" }, 400);

  const limitParam = Number(c.req.query("limit") ?? 4);
  const limit = Number.isInteger(limitParam) ? Math.min(Math.max(limitParam, 1), 50) : 4;
  const beforeParam = c.req.query("before");
  const before = beforeParam !== undefined ? Number(beforeParam) : undefined;
  if (before !== undefined && !Number.isInteger(before)) {
    return c.json({ error: "Invalid cursor" }, 400);
  }

  const card = await prisma.card.findUnique({ where: { id }, select: { id: true } });
  if (!card) return c.json({ error: "Card not found" }, 404);

  const [rows, total] = await Promise.all([
    prisma.cardEvent.findMany({
      where: { cardId: id, ...(before !== undefined ? { id: { lt: before } } : {}) },
      orderBy: { id: "desc" },
      take: limit + 1,
      select: { id: true, type: true, data: true, createdAt: true },
    }),
    prisma.cardEvent.count({ where: { cardId: id } }),
  ]);

  return c.json({ events: rows.slice(0, limit), hasMore: rows.length > limit, total });
});

// PATCH /api/cards/:id - edit fields and/or move (columnId/position)
cards.patch("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id)) return c.json({ error: "Invalid card id" }, 400);

  const check = await requireCardEditKey(id, c.req.header("X-Edit-Key"));
  if (!check.ok) return c.json({ error: check.error }, check.status);

  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: "Invalid body" }, 400);

  const data: Record<string, unknown> = {};
  let newColumnName: string | null = null;
  let newPriorityName: string | null = null;
  let newTags: { id: number; name: string }[] | null = null;
  if (body.title !== undefined) {
    const title = String(body.title).trim();
    if (!title || title.length > 255) {
      return c.json({ error: "Title must be 1-255 chars" }, 400);
    }
    data.title = title;
  }
  if (body.body !== undefined) {
    data.body = body.body === null ? null : String(body.body);
  }
  if (body.columnId !== undefined) {
    const columnId = Number(body.columnId);
    if (!Number.isInteger(columnId)) {
      return c.json({ error: "Invalid column id" }, 400);
    }
    // Verify the column belongs to the card's board
    const col = await prisma.column.findFirst({
      where: { id: columnId, boardId: check.card.boardId },
    });
    if (!col) {
      return c.json({ error: "Invalid column" }, 400);
    }
    data.columnId = columnId;
    newColumnName = col.name;
  }
  if (body.position !== undefined) {
    const position = Number(body.position);
    if (!Number.isInteger(position) || position < 0) {
      return c.json({ error: "Invalid position" }, 400);
    }
    data.position = position;
  }
  if (body.priorityId !== undefined) {
    if (body.priorityId === null) {
      data.priorityId = null;
    } else {
      const priorityId = Number(body.priorityId);
      const owned = Number.isInteger(priorityId)
        ? await prisma.priority.findFirst({
            where: { id: priorityId, boardId: check.card.boardId },
            select: { id: true, name: true },
          })
        : null;
      if (!owned) return c.json({ error: "Invalid priority" }, 400);
      data.priorityId = priorityId;
      newPriorityName = owned.name;
    }
  }

  if (body.points !== undefined) {
    const parsed = parsePoints(body.points);
    if (!parsed.ok) return c.json({ error: `Story points must be a whole number from 0 to ${MAX_POINTS}` }, 400);
    data.points = parsed.value;
  }

  // archived: true stamps archivedAt; false restores the card to the end of its column.
  if (body.archived !== undefined) {
    if (typeof body.archived !== "boolean") {
      return c.json({ error: "Invalid archived flag" }, 400);
    }
    if (body.archived) {
      if (!check.card.archivedAt) data.archivedAt = new Date();
    } else if (check.card.archivedAt) {
      data.archivedAt = null;
      if (body.position === undefined) {
        const targetColumnId = (data.columnId as number | undefined) ?? check.card.columnId;
        const last = await prisma.card.findFirst({
          where: { columnId: targetColumnId, archivedAt: null },
          orderBy: { position: "desc" },
          select: { position: true },
        });
        data.position = last ? last.position + 1 : 0;
      }
    }
  }

  // When tagIds is present, replace the card's tag set (only with tags owned by this board).
  if (Array.isArray(body.tagIds)) {
    const tagIds = body.tagIds.filter((t: unknown): t is number => Number.isInteger(t));
    const owned = await prisma.tag.findMany({
      where: { id: { in: tagIds }, boardId: check.card.boardId },
      select: { id: true, name: true },
    });
    data.tags = { set: owned.map((t) => ({ id: t.id })) };
    newTags = owned;
  }

  const events = await describeChanges(id, data, { newColumnName, newPriorityName, newTags });

  const [updated] = await prisma.$transaction([
    prisma.card.update({ where: { id }, data, include: { tags: true } }),
    prisma.cardEvent.createMany({ data: eventRows(id, check.card.boardId, events) }),
  ]);
  return c.json(updated);
});

// DELETE /api/cards/:id
cards.delete("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id)) return c.json({ error: "Invalid card id" }, 400);

  const check = await requireCardEditKey(id, c.req.header("X-Edit-Key"));
  if (!check.ok) return c.json({ error: check.error }, check.status);

  await prisma.card.delete({ where: { id } });
  return c.json({ ok: true });
});

// Compares the stored card with the pending update and returns activity entries.
// Position-only changes (reordering within a column) are deliberately not logged.
async function describeChanges(
  id: number,
  data: Record<string, unknown>,
  names: { newColumnName: string | null; newPriorityName: string | null; newTags: { id: number; name: string }[] | null }
): Promise<CardEventInput[]> {
  const before = await prisma.card.findUnique({
    where: { id },
    include: { column: { select: { name: true } }, priority: { select: { name: true } }, tags: { select: { id: true, name: true } } },
  });
  if (!before) return [];
  const events: CardEventInput[] = [];

  if ("archivedAt" in data) {
    events.push({ type: data.archivedAt ? "archived" : "restored", data: null });
  }
  if (data.columnId !== undefined && data.columnId !== before.columnId && names.newColumnName) {
    events.push({ type: "moved", data: { from: before.column.name, to: names.newColumnName } });
  }
  if (data.title !== undefined && data.title !== before.title) {
    events.push({ type: "title", data: { from: before.title, to: data.title as string } });
  }
  if (data.body !== undefined && ((data.body as string | null) ?? "") !== (before.body ?? "")) {
    events.push({ type: "description", data: null });
  }
  if (data.priorityId !== undefined && data.priorityId !== before.priorityId) {
    events.push({
      type: "priority",
      data: { from: before.priority?.name ?? null, to: data.priorityId === null ? null : names.newPriorityName },
    });
  }
  if (data.points !== undefined && data.points !== before.points) {
    events.push({ type: "points", data: { from: before.points, to: data.points as number | null } });
  }
  if (names.newTags) {
    const beforeIds = new Set(before.tags.map((t) => t.id));
    const afterIds = new Set(names.newTags.map((t) => t.id));
    const added = names.newTags.filter((t) => !beforeIds.has(t.id)).map((t) => t.name);
    const removed = before.tags.filter((t) => !afterIds.has(t.id)).map((t) => t.name);
    if (added.length || removed.length) events.push({ type: "tags", data: { added, removed } });
  }
  return events;
}
