import { Hono } from "hono";
import { customAlphabet } from "nanoid";
import type { Prisma } from "@prisma/client";
import { prisma } from "../db.js";
import { hashEditKey, isValidPrefix, requireEditKey, verifyEditKey } from "../auth.js";
import { DEFAULT_COLUMNS, MAX_COLUMNS, isValidPaletteColor } from "../columns.js";
import { DEFAULT_PRIORITIES, MAX_PRIORITIES, isValidPriorityName } from "../priorities.js";

const nanoidId = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 10);
const nanoidKey = customAlphabet(
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789",
  24
);

export const boards = new Hono();

// POST /api/boards - create a board
boards.post("/", async (c) => {
  const body = await c.req.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const prefix = typeof body?.prefix === "string" ? body.prefix.trim().toUpperCase() : "";

  if (!title || title.length > 255) {
    return c.json({ error: "Title is required (max 255 chars)" }, 400);
  }
  if (!isValidPrefix(prefix)) {
    return c.json({ error: "Prefix must be 1-16 uppercase alphanumeric chars" }, 400);
  }

  const id = nanoidId();
  const editKey = nanoidKey();
  const editHash = await hashEditKey(editKey);

  await prisma.board.create({
    data: {
      id,
      title,
      prefix,
      editHash,
      columns: {
        create: DEFAULT_COLUMNS,
      },
      priorities: {
        create: DEFAULT_PRIORITIES,
      },
    },
  });

  return c.json({ id, editKey }, 201);
});

// GET /api/boards/:id - fetch board + cards
boards.get("/:id", async (c) => {
  const id = c.req.param("id");
  const board = await prisma.board.findUnique({ where: { id } });
  if (!board) return c.json({ error: "Board not found" }, 404);

  const [cards, tags, columns, priorities] = await Promise.all([
    prisma.card.findMany({
      where: { boardId: id },
      orderBy: [{ columnId: "asc" }, { position: "asc" }],
      include: { tags: true },
    }),
    prisma.tag.findMany({
      where: { boardId: id },
      orderBy: { name: "asc" },
    }),
    prisma.column.findMany({
      where: { boardId: id },
      orderBy: { position: "asc" },
    }),
    prisma.priority.findMany({
      where: { boardId: id },
      orderBy: [{ position: "asc" }, { id: "asc" }],
    }),
  ]);

  return c.json({
    board: { id: board.id, title: board.title, prefix: board.prefix },
    cards,
    tags,
    columns,
    priorities,
  });
});

// PATCH /api/boards/:id - update board fields (currently title) (edit-key protected)
boards.patch("/:id", requireEditKey, async (c) => {
  const boardId = c.req.param("id");
  if (!boardId) return c.json({ error: "Missing board id" }, 400);
  const body = await c.req.json().catch(() => null);

  const title = typeof body?.title === "string" ? body.title.trim() : "";
  if (!title || title.length > 255) {
    return c.json({ error: "Title is required (max 255 chars)" }, 400);
  }

  const board = await prisma.board.update({
    where: { id: boardId },
    data: { title },
  });

  return c.json({ id: board.id, title: board.title, prefix: board.prefix });
});

// GET /api/boards/:id/verify - check whether a supplied X-Edit-Key is valid
boards.get("/:id/verify", async (c) => {
  const id = c.req.param("id");
  const key = c.req.header("X-Edit-Key");
  const board = await prisma.board.findUnique({ where: { id } });
  if (!board) return c.json({ error: "Board not found" }, 404);
  if (!key) return c.json({ valid: false });
  const valid = await verifyEditKey(key, board.editHash);
  return c.json({ valid });
});

// POST /api/boards/:id/cards - create a card (edit-key protected)
boards.post("/:id/cards", requireEditKey, async (c) => {
  const boardId = c.req.param("id");
  if (!boardId) return c.json({ error: "Missing board id" }, 400);
  const body = await c.req.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const cardBody = typeof body?.body === "string" ? body.body : null;

  if (!title || title.length > 255) {
    return c.json({ error: "Title is required (max 255 chars)" }, 400);
  }

  // Resolve columnId: must belong to this board; default to lowest-position column
  let columnId: number | undefined = undefined;
  if (typeof body?.columnId === "number" && Number.isInteger(body.columnId)) {
    columnId = body.columnId;
  }
  if (columnId === undefined) {
    const firstCol = await prisma.column.findFirst({
      where: { boardId },
      orderBy: { position: "asc" },
    });
    if (!firstCol) {
      return c.json({ error: "Board has no columns" }, 400);
    }
    columnId = firstCol.id;
  } else {
    const col = await prisma.column.findFirst({
      where: { id: columnId, boardId },
    });
    if (!col) {
      return c.json({ error: "Invalid column" }, 400);
    }
  }

  // Optional priority; must belong to this board.
  let priorityId: number | null = null;
  if (body?.priorityId !== undefined && body.priorityId !== null) {
    const pid = Number(body.priorityId);
    const owned = Number.isInteger(pid)
      ? await prisma.priority.findFirst({ where: { id: pid, boardId }, select: { id: true } })
      : null;
    if (!owned) return c.json({ error: "Invalid priority" }, 400);
    priorityId = owned.id;
  }

  const card = await prisma.$transaction(async (tx) => {
    const updatedBoard = await tx.board.update({
      where: { id: boardId },
      data: { nextSeq: { increment: 1 } },
    });
    const seq = updatedBoard.nextSeq - 1;

    const last = await tx.card.findFirst({
      where: { boardId, columnId },
      orderBy: { position: "desc" },
    });
    const position = last ? last.position + 1 : 0;

    const data: Prisma.CardUncheckedCreateInput = {
      boardId,
      seq,
      title,
      body: cardBody,
      columnId,
      priorityId,
      position,
    };

    // Attach only tags that belong to this board (guard against cross-board ids).
    const tagIds = Array.isArray(body.tagIds)
      ? body.tagIds.filter((t: unknown): t is number => Number.isInteger(t))
      : [];
    if (tagIds.length > 0) {
      const owned = await tx.tag.findMany({
        where: { id: { in: tagIds }, boardId },
        select: { id: true },
      });
      if (owned.length > 0) {
        data.tags = { connect: owned.map((t) => ({ id: t.id })) };
      }
    }

    return tx.card.create({ data, include: { tags: true } });
  });

  return c.json(card, 201);
});

// POST /api/boards/:id/columns - create a column (edit-key protected)
boards.post("/:id/columns", requireEditKey, async (c) => {
  const boardId = c.req.param("id");
  if (!boardId) return c.json({ error: "Missing board id" }, 400);
  const body = await c.req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const color = typeof body?.color === "string" ? body.color : "";

  if (!name || name.length > 50) {
    return c.json({ error: "Column name must be 1-50 chars" }, 400);
  }
  if (!isValidPaletteColor(color)) {
    return c.json({ error: "Invalid color" }, 400);
  }

  const count = await prisma.column.count({ where: { boardId } });
  if (count >= MAX_COLUMNS) {
    return c.json({ error: `A board can have at most ${MAX_COLUMNS} columns` }, 400);
  }

  const maxPos = await prisma.column.aggregate({
    where: { boardId },
    _max: { position: true },
  });
  const position = (maxPos._max.position ?? -1) + 1;

  const column = await prisma.column.create({
    data: { boardId, name, color, position },
  });

  return c.json(column, 201);
});

// POST /api/boards/:id/priorities - create a priority, appended as least urgent (edit-key protected)
boards.post("/:id/priorities", requireEditKey, async (c) => {
  const boardId = c.req.param("id");
  if (!boardId) return c.json({ error: "Missing board id" }, 400);
  const body = await c.req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const color = typeof body?.color === "string" ? body.color : "";

  if (!isValidPriorityName(name)) {
    return c.json({ error: "Priority name must be 1-30 chars" }, 400);
  }
  if (!isValidPaletteColor(color)) {
    return c.json({ error: "Invalid color" }, 400);
  }

  const existing = await prisma.priority.findMany({
    where: { boardId },
    select: { name: true, position: true },
  });
  if (existing.length >= MAX_PRIORITIES) {
    return c.json({ error: `A board can have at most ${MAX_PRIORITIES} priorities` }, 400);
  }
  if (existing.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
    return c.json({ error: "A priority with this name already exists" }, 400);
  }
  const position = existing.reduce((max, p) => Math.max(max, p.position), -1) + 1;

  const priority = await prisma.priority.create({
    data: { boardId, name, color, position },
  });

  return c.json(priority, 201);
});

// POST /api/boards/:id/tags - create (or return existing) tag for a board (edit-key protected)
boards.post("/:id/tags", requireEditKey, async (c) => {
  const boardId = c.req.param("id");
  if (!boardId) return c.json({ error: "Missing board id" }, 400);
  const body = await c.req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";

  if (!name || name.length > 50) {
    return c.json({ error: "Tag name must be 1-50 chars" }, 400);
  }

  // Enforce a maximum of 5 tags per board. Upsert means an existing name
  // won't count against the limit, so only check when creating new.
  const existing = await prisma.tag.findUnique({
    where: { boardId_name: { boardId, name } },
    select: { id: true },
  });
  if (!existing) {
    const count = await prisma.tag.count({ where: { boardId } });
    if (count >= 5) {
      return c.json({ error: "A board can have at most 5 tags" }, 400);
    }
  }

  const tag = await prisma.tag.upsert({
    where: { boardId_name: { boardId, name } },
    update: {},
    create: { boardId, name },
  });

  return c.json(tag, 201);
});
