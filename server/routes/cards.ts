import { Hono } from "hono";
import { prisma } from "../db.js";
import { notifyBoard } from "../live.js";
import { verifyEditKey } from "../auth.js";
import { eventRows, type CardEventInput } from "../events.js";
import { MAX_POINTS, parsePoints } from "../points.js";
import {
  MAX_AUTHOR_LENGTH,
  MAX_COMMENT_LENGTH,
  commentCountInclude,
  parseAuthor,
  commentExcerpt,
  parseCommentBody,
  withCommentCount,
} from "../comments.js";

export const cards = new Hono();

async function requireCardEditKey(cardId: number, key: string | undefined) {
  if (!key) return { ok: false as const, status: 401 as const, error: "Missing edit key" };
  const card = await prisma.card.findUnique({ where: { id: cardId } });
  if (!card) return { ok: false as const, status: 404 as const, error: "Card not found" };
  const board = await prisma.board.findUnique({ where: { id: card.boardId } });
  if (!board) return { ok: false as const, status: 404 as const, error: "Board not found" };
  const valid = await verifyEditKey(key, board.editHash);
  if (!valid) return { ok: false as const, status: 401 as const, error: "Invalid edit key" };
  return { ok: true as const, card, board };
}

const MAX_BLOCKERS = 20;

// POST /api/cards/:id/dependencies { blockerId } - mark this card as blocked by another card
cards.post("/:id/dependencies", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id)) return c.json({ error: "Invalid card id" }, 400);

  const check = await requireCardEditKey(id, c.req.header("X-Edit-Key"));
  if (!check.ok) return c.json({ error: check.error }, check.status);

  const body = await c.req.json().catch(() => null);
  const blockerId = Number(body?.blockerId);
  if (!Number.isInteger(blockerId)) return c.json({ error: "Invalid blocker card" }, 400);
  if (blockerId === id) return c.json({ error: "A card can't block itself" }, 400);

  const boardId = check.card.boardId;
  const blocker = await prisma.card.findFirst({ where: { id: blockerId, boardId } });
  if (!blocker) return c.json({ error: "Blocker must be a card on this board" }, 400);

  const links = await prisma.cardDependency.findMany({
    where: { boardId },
    select: { blockedId: true, blockerId: true },
  });
  if (links.some((l) => l.blockedId === id && l.blockerId === blockerId)) {
    return c.json({ error: "That dependency already exists" }, 400);
  }
  if (links.filter((l) => l.blockedId === id).length >= MAX_BLOCKERS) {
    return c.json({ error: `A card can be blocked by at most ${MAX_BLOCKERS} cards` }, 400);
  }
  if (wouldCreateCycle(links, id, blockerId)) {
    return c.json({ error: "That would create a loop — the other card already depends on this one" }, 400);
  }

  const prefix = check.board.prefix;
  await prisma.$transaction([
    prisma.cardDependency.create({ data: { boardId, blockedId: id, blockerId } }),
    prisma.cardEvent.createMany({
      data: [
        ...eventRows(id, boardId, [
          { type: "dependency", data: { action: "added", role: "blocked_by", card: `${prefix}-${blocker.seq}`, title: blocker.title } },
        ]),
        ...eventRows(blockerId, boardId, [
          { type: "dependency", data: { action: "added", role: "blocks", card: `${prefix}-${check.card.seq}`, title: check.card.title } },
        ]),
      ],
    }),
  ]);
  notifyBoard(c, boardId, "card", id);
  return c.json({ blockedId: id, blockerId }, 201);
});

// DELETE /api/cards/:id/dependencies/:blockerId - remove a "blocked by" link
cards.delete("/:id/dependencies/:blockerId", async (c) => {
  const id = Number(c.req.param("id"));
  const blockerId = Number(c.req.param("blockerId"));
  if (!Number.isInteger(id) || !Number.isInteger(blockerId)) return c.json({ error: "Invalid card id" }, 400);

  const check = await requireCardEditKey(id, c.req.header("X-Edit-Key"));
  if (!check.ok) return c.json({ error: check.error }, check.status);

  const link = await prisma.cardDependency.findUnique({
    where: { blockedId_blockerId: { blockedId: id, blockerId } },
    include: { blocker: { select: { seq: true, title: true } } },
  });
  if (!link) return c.json({ error: "Dependency not found" }, 404);

  const boardId = check.card.boardId;
  const prefix = check.board.prefix;
  await prisma.$transaction([
    prisma.cardDependency.delete({ where: { id: link.id } }),
    prisma.cardEvent.createMany({
      data: [
        ...eventRows(id, boardId, [
          { type: "dependency", data: { action: "removed", role: "blocked_by", card: `${prefix}-${link.blocker.seq}`, title: link.blocker.title } },
        ]),
        ...eventRows(blockerId, boardId, [
          { type: "dependency", data: { action: "removed", role: "blocks", card: `${prefix}-${check.card.seq}`, title: check.card.title } },
        ]),
      ],
    }),
  ]);
  notifyBoard(c, boardId, "card", id);
  return c.json({ ok: true });
});

// Adding "blocked is blocked by blocker" loops if `blocked` is already, directly or
// transitively, one of `blocker`'s blockers.
function wouldCreateCycle(links: { blockedId: number; blockerId: number }[], blocked: number, blocker: number): boolean {
  const blockersOf = new Map<number, number[]>();
  for (const l of links) {
    const list = blockersOf.get(l.blockedId) ?? [];
    list.push(l.blockerId);
    blockersOf.set(l.blockedId, list);
  }
  const seen = new Set<number>();
  const stack = [blocker];
  while (stack.length) {
    const current = stack.pop()!;
    if (current === blocked) return true;
    if (seen.has(current)) continue;
    seen.add(current);
    stack.push(...(blockersOf.get(current) ?? []));
  }
  return false;
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

// GET /api/cards/:id/comments?limit=5&before=<commentId> - the latest comments, oldest first,
// with hasMore when there are earlier ones (public, like the board)
cards.get("/:id/comments", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id)) return c.json({ error: "Invalid card id" }, 400);

  const limitParam = Number(c.req.query("limit") ?? 5);
  const limit = Number.isInteger(limitParam) ? Math.min(Math.max(limitParam, 1), 50) : 5;
  const beforeParam = c.req.query("before");
  const before = beforeParam !== undefined ? Number(beforeParam) : undefined;
  if (before !== undefined && !Number.isInteger(before)) {
    return c.json({ error: "Invalid cursor" }, 400);
  }

  const card = await prisma.card.findUnique({ where: { id }, select: { id: true } });
  if (!card) return c.json({ error: "Card not found" }, 404);

  const [rows, total] = await Promise.all([
    prisma.cardComment.findMany({
      where: { cardId: id, ...(before !== undefined ? { id: { lt: before } } : {}) },
      orderBy: { id: "desc" },
      take: limit + 1,
    }),
    prisma.cardComment.count({ where: { cardId: id } }),
  ]);

  return c.json({ comments: rows.slice(0, limit).reverse(), hasMore: rows.length > limit, total });
});

// POST /api/cards/:id/comments { body, author? } - add a comment (edit-key protected)
cards.post("/:id/comments", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id)) return c.json({ error: "Invalid card id" }, 400);

  const check = await requireCardEditKey(id, c.req.header("X-Edit-Key"));
  if (!check.ok) return c.json({ error: check.error }, check.status);

  const payload = await c.req.json().catch(() => null);
  const body = parseCommentBody(payload?.body);
  if (body === null) return c.json({ error: `Comment must be 1-${MAX_COMMENT_LENGTH} characters` }, 400);
  const author = parseAuthor(payload?.author);
  if (!author.ok) return c.json({ error: `Name must be at most ${MAX_AUTHOR_LENGTH} characters` }, 400);

  const [comment] = await prisma.$transaction([
    prisma.cardComment.create({
      data: { cardId: id, boardId: check.card.boardId, author: author.value, body },
    }),
    prisma.cardEvent.createMany({
      data: eventRows(id, check.card.boardId, [
        { type: "comment", data: { action: "added", author: author.value, excerpt: commentExcerpt(body) } },
      ]),
    }),
  ]);
  notifyBoard(c, check.card.boardId, "card", id);
  return c.json(comment, 201);
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
    prisma.card.update({ where: { id }, data, include: { tags: true, ...commentCountInclude } }),
    prisma.cardEvent.createMany({ data: eventRows(id, check.card.boardId, events) }),
  ]);
  notifyBoard(c, check.card.boardId, "card", id);
  return c.json(withCommentCount(updated));
});

// DELETE /api/cards/:id
cards.delete("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id)) return c.json({ error: "Invalid card id" }, 400);

  const check = await requireCardEditKey(id, c.req.header("X-Edit-Key"));
  if (!check.ok) return c.json({ error: check.error }, check.status);

  const links = await prisma.cardDependency.findMany({
    where: { OR: [{ blockedId: id }, { blockerId: id }] },
    select: { blockedId: true, blockerId: true },
  });
  const label = `${check.board.prefix}-${check.card.seq}`;
  const boardId = check.card.boardId;
  await prisma.$transaction([
    prisma.card.delete({ where: { id } }),
    prisma.cardEvent.createMany({
      data: links.flatMap((l) =>
        l.blockerId === id
          ? eventRows(l.blockedId, boardId, [
              { type: "dependency", data: { action: "removed", role: "blocked_by", card: label, title: check.card.title, reason: "deleted" } },
            ])
          : eventRows(l.blockerId, boardId, [
              { type: "dependency", data: { action: "removed", role: "blocks", card: label, title: check.card.title, reason: "deleted" } },
            ])
      ),
    }),
  ]);
  notifyBoard(c, boardId, "card", id);
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
