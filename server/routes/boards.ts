import { Hono } from "hono";
import { customAlphabet } from "nanoid";
import type { Board, Prisma } from "@prisma/client";
import { prisma } from "../db.js";
import { hashEditKey, isValidPrefix, requireEditKey, verifyEditKey } from "../auth.js";
import { defaultColumns, MAX_COLUMNS, isValidPaletteColor } from "../columns.js";
import { fail } from "../errors.js";
import { eventRows, type CardEventInput } from "../events.js";
import { MAX_POINTS, parsePoints } from "../points.js";
import { isValidBoardIcon } from "../boardIcons.js";
import { commentCountInclude, withCommentCount } from "../comments.js";
import { streamSSE } from "hono/streaming";
import { notifyBoard, subscribe, viewerCount } from "../live.js";
import { defaultPriorities, MAX_PRIORITIES, isValidPriorityName } from "../priorities.js";
import { parseBoardLocale, type BoardLocale } from "../locale.js";

const nanoidId = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 10);
const nanoidKey = customAlphabet(
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789",
  24
);

export const boards = new Hono<{ Variables: { board: Board } }>();

// Card numbers can start (or continue) above 1 for teams migrating from another tracker.
const MAX_SEQ = 999_999;

function parseSeq(value: unknown): number | null {
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  return typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= MAX_SEQ ? n : null;
}

function publicBoard(board: {
  id: string;
  title: string;
  prefix: string;
  icon: string | null;
  nextSeq: number;
  pointsEnabled: boolean;
  dependenciesEnabled: boolean;
}) {
  return {
    id: board.id,
    title: board.title,
    prefix: board.prefix,
    icon: board.icon,
    nextSeq: board.nextSeq,
    pointsEnabled: board.pointsEnabled,
    dependenciesEnabled: board.dependenciesEnabled,
  };
}

// POST /api/boards - create a board
boards.post("/", async (c) => {
  const body = await c.req.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const prefix = typeof body?.prefix === "string" ? body.prefix.trim().toUpperCase() : "";

  if (!title || title.length > 255) {
    return fail(c, 400, "BOARD_TITLE_LENGTH", "Title is required (max 255 chars)", { max: 255 });
  }
  if (!isValidPrefix(prefix)) {
    return fail(c, 400, "BOARD_PREFIX_INVALID", "Prefix must be 1-16 uppercase alphanumeric chars");
  }
  // Optional creation locale for the seeded column/priority names. Omitted means English;
  // a present but unsupported value is a malformed request, not a silent fallback.
  let locale: BoardLocale = "en";
  if (body?.locale !== undefined && body?.locale !== null) {
    const parsed = parseBoardLocale(body.locale);
    if (!parsed) return fail(c, 400, "INVALID_BODY", "Invalid body");
    locale = parsed;
  }
  let startAt = 1;
  if (body?.startAt !== undefined && body.startAt !== null) {
    const parsed = parseSeq(body.startAt);
    if (parsed === null) {
      return fail(c, 400, "BOARD_START_SEQ_RANGE", `Starting number must be a whole number from 1 to ${MAX_SEQ}`, {
        max: MAX_SEQ,
      });
    }
    startAt = parsed;
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
      nextSeq: startAt,
      columns: {
        create: defaultColumns(locale),
      },
      priorities: {
        create: defaultPriorities(locale),
      },
    },
  });

  return c.json({ id, editKey }, 201);
});

// GET /api/boards/:id - fetch board + cards
boards.get("/:id", async (c) => {
  const id = c.req.param("id");
  const board = await prisma.board.findUnique({ where: { id } });
  if (!board) return fail(c, 404, "BOARD_NOT_FOUND", "Board not found");

  const [cards, tags, columns, priorities, dependencies] = await Promise.all([
    prisma.card.findMany({
      where: { boardId: id },
      orderBy: [{ columnId: "asc" }, { position: "asc" }],
      include: { tags: true, ...commentCountInclude },
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
    prisma.cardDependency.findMany({
      where: { boardId: id },
      select: { blockedId: true, blockerId: true },
      orderBy: { id: "asc" },
    }),
  ]);

  return c.json({
    board: publicBoard(board),
    cards: cards.map(withCommentCount),
    tags,
    columns,
    priorities,
    dependencies,
  });
});

// PATCH /api/boards/:id - update title and/or the next card number (edit-key protected)
boards.patch("/:id", requireEditKey, async (c) => {
  const boardId = c.req.param("id");
  if (!boardId) return fail(c, 400, "MISSING_BOARD_ID", "Missing board id");
  const body = await c.req.json().catch(() => null);
  if (!body) return fail(c, 400, "INVALID_BODY", "Invalid body");

  const data: {
    title?: string;
    icon?: string | null;
    nextSeq?: number;
    pointsEnabled?: boolean;
    dependenciesEnabled?: boolean;
  } = {};

  if (body.icon !== undefined) {
    if (body.icon !== null && !isValidBoardIcon(body.icon)) {
      return fail(c, 400, "BOARD_ICON_UNKNOWN", "Unknown board icon");
    }
    data.icon = body.icon;
  }

  if (body.title !== undefined) {
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title || title.length > 255) {
      return fail(c, 400, "BOARD_TITLE_LENGTH", "Title is required (max 255 chars)", { max: 255 });
    }
    data.title = title;
  }

  if (body.nextSeq !== undefined) {
    const nextSeq = parseSeq(body.nextSeq);
    if (nextSeq === null) {
      return fail(c, 400, "BOARD_NEXT_SEQ_RANGE", `Next card number must be a whole number from 1 to ${MAX_SEQ}`, {
        max: MAX_SEQ,
      });
    }
    // Never reuse an existing ID (archived cards included): seq is unique per board.
    const { _max } = await prisma.card.aggregate({ where: { boardId }, _max: { seq: true } });
    const highest = _max.seq ?? 0;
    if (nextSeq <= highest) {
      return fail(c, 400, "BOARD_NEXT_SEQ_TOO_LOW", `Next card number must be higher than ${highest}, the highest ID in use`, {
        highest,
      });
    }
    data.nextSeq = nextSeq;
  }

  if (body.pointsEnabled !== undefined) {
    if (typeof body.pointsEnabled !== "boolean") {
      return fail(c, 400, "BOARD_POINTS_SETTING_INVALID", "Invalid story points setting");
    }
    // Turning points off only hides them; card estimates are kept.
    data.pointsEnabled = body.pointsEnabled;
  }

  if (body.dependenciesEnabled !== undefined) {
    if (typeof body.dependenciesEnabled !== "boolean") {
      return fail(c, 400, "BOARD_DEPENDENCIES_SETTING_INVALID", "Invalid dependencies setting");
    }
    // Turning dependencies off only hides them; links are kept.
    data.dependenciesEnabled = body.dependenciesEnabled;
  }

  if (Object.keys(data).length === 0) {
    return fail(c, 400, "BOARD_NOTHING_TO_UPDATE", "Nothing to update");
  }

  const board = await prisma.board.update({ where: { id: boardId }, data });
  notifyBoard(c, boardId, "board");
  return c.json(publicBoard(board));
});

// DELETE /api/boards/:id - permanently delete a board and everything on it (edit-key protected).
// The client must echo the board title, so deleting is never a single accidental click.
boards.delete("/:id", requireEditKey, async (c) => {
  const board = c.get("board");
  const boardId = c.req.param("id");
  if (!boardId) return fail(c, 400, "MISSING_BOARD_ID", "Missing board id");
  const body = await c.req.json().catch(() => null);
  const confirm = typeof body?.confirm === "string" ? body.confirm.trim() : "";
  if (confirm !== board.title) {
    return fail(c, 400, "BOARD_CONFIRM_TITLE", "Type the board title to confirm");
  }

  // Cards → Column has no onDelete rule (RESTRICT), so the board cascade would fail if the
  // columns were removed first. Deleting cards explicitly lets the rest cascade from them.
  await prisma.$transaction([
    prisma.card.deleteMany({ where: { boardId } }),
    prisma.board.delete({ where: { id: boardId } }),
  ]);

  notifyBoard(c, boardId, "deleted");
  return c.json({ ok: true });
});

// GET /api/boards/:id/stream?client=<tabId> - Server-Sent Events: "change" when anything on the
// board changes (clients reload), "presence" with the number of open viewers. Public, like the board.
const HEARTBEAT_MS = 25_000;
boards.get("/:id/stream", async (c) => {
  const boardId = c.req.param("id");
  const exists = await prisma.board.findUnique({ where: { id: boardId }, select: { id: true } });
  if (!exists) return fail(c, 404, "BOARD_NOT_FOUND", "Board not found");
  const clientId = (c.req.query("client") ?? "").slice(0, 64);

  // Stop nginx (CloudPanel) from buffering the stream.
  c.header("X-Accel-Buffering", "no");
  c.header("Cache-Control", "no-cache, no-transform");

  return streamSSE(c, async (stream) => {
    let open = true;
    let unsubscribe: (() => void) | null = null;
    // Runs once, whichever notices first: the client aborting or a failed write.
    const close = () => {
      open = false;
      unsubscribe?.();
      unsubscribe = null;
    };
    unsubscribe = subscribe(boardId, {
      clientId,
      send: (event, data) => {
        if (open) stream.writeSSE({ event, data: JSON.stringify(data) }).catch(close);
      },
    });
    stream.onAbort(close);
    await stream.writeSSE({ event: "hello", data: JSON.stringify({ viewers: viewerCount(boardId) }), retry: 3000 });
    // Heartbeats keep proxies from closing an idle connection (and reveal dead ones).
    while (open) {
      await stream.sleep(HEARTBEAT_MS);
      if (open) await stream.writeSSE({ event: "ping", data: "" }).catch(close);
    }
    close();
  });
});

// GET /api/boards/:id/verify - check whether a supplied X-Edit-Key is valid
boards.get("/:id/verify", async (c) => {
  const id = c.req.param("id");
  const key = c.req.header("X-Edit-Key");
  const board = await prisma.board.findUnique({ where: { id } });
  if (!board) return fail(c, 404, "BOARD_NOT_FOUND", "Board not found");
  if (!key) return c.json({ valid: false });
  const valid = await verifyEditKey(key, board.editHash);
  return c.json({ valid });
});

// POST /api/boards/:id/cards - create a card (edit-key protected)
boards.post("/:id/cards", requireEditKey, async (c) => {
  const boardId = c.req.param("id");
  if (!boardId) return fail(c, 400, "MISSING_BOARD_ID", "Missing board id");
  const body = await c.req.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const cardBody = typeof body?.body === "string" ? body.body : null;

  if (!title || title.length > 255) {
    return fail(c, 400, "CARD_TITLE_LENGTH", "Title is required (max 255 chars)", { max: 255 });
  }

  // Resolve columnId: must belong to this board; default to lowest-position column
  let columnId: number | undefined = undefined;
  let columnName = "";
  if (typeof body?.columnId === "number" && Number.isInteger(body.columnId)) {
    columnId = body.columnId;
  }
  if (columnId === undefined) {
    const firstCol = await prisma.column.findFirst({
      where: { boardId },
      orderBy: { position: "asc" },
    });
    if (!firstCol) {
      return fail(c, 400, "BOARD_NO_COLUMNS", "Board has no columns");
    }
    columnId = firstCol.id;
    columnName = firstCol.name;
  } else {
    const col = await prisma.column.findFirst({
      where: { id: columnId, boardId },
    });
    if (!col) {
      return fail(c, 400, "INVALID_COLUMN", "Invalid column");
    }
    columnName = col.name;
  }

  // Optional priority; must belong to this board.
  let priorityId: number | null = null;
  let priorityName: string | null = null;
  if (body?.priorityId !== undefined && body.priorityId !== null) {
    const pid = Number(body.priorityId);
    const owned = Number.isInteger(pid)
      ? await prisma.priority.findFirst({ where: { id: pid, boardId }, select: { id: true, name: true } })
      : null;
    if (!owned) return fail(c, 400, "INVALID_PRIORITY", "Invalid priority");
    priorityId = owned.id;
    priorityName = owned.name;
  }

  let points: number | null = null;
  if (body?.points !== undefined) {
    const parsed = parsePoints(body.points);
    if (!parsed.ok) {
      return fail(c, 400, "CARD_STORY_POINTS_RANGE", `Story points must be a whole number from 0 to ${MAX_POINTS}`, {
        max: MAX_POINTS,
      });
    }
    points = parsed.value;
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
      points,
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

    const created = await tx.card.create({ data, include: { tags: true } });
    // Log what the card started with, so its history is complete from the first entry.
    const initial: CardEventInput[] = [{ type: "created", data: { column: columnName } }];
    if (priorityName) initial.push({ type: "priority", data: { from: null, to: priorityName } });
    if (created.tags.length) initial.push({ type: "tags", data: { added: created.tags.map((t) => t.name), removed: [] } });
    if (points !== null) initial.push({ type: "points", data: { from: null, to: points } });
    await tx.cardEvent.createMany({ data: eventRows(created.id, boardId, initial) });
    return created;
  });

  notifyBoard(c, boardId, "card", card.id);
  return c.json({ ...card, commentCount: 0 }, 201);
});

// POST /api/boards/:id/columns - create a column (edit-key protected)
boards.post("/:id/columns", requireEditKey, async (c) => {
  const boardId = c.req.param("id");
  if (!boardId) return fail(c, 400, "MISSING_BOARD_ID", "Missing board id");
  const body = await c.req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const color = typeof body?.color === "string" ? body.color : "";

  if (!name || name.length > 50) {
    return fail(c, 400, "COLUMN_NAME_LENGTH", "Column name must be 1-50 chars", { min: 1, max: 50 });
  }
  if (!isValidPaletteColor(color)) {
    return fail(c, 400, "INVALID_COLOR", "Invalid color");
  }

  const count = await prisma.column.count({ where: { boardId } });
  if (count >= MAX_COLUMNS) {
    return fail(c, 400, "BOARD_MAX_COLUMNS", `A board can have at most ${MAX_COLUMNS} columns`, {
      max: MAX_COLUMNS,
    });
  }

  const maxPos = await prisma.column.aggregate({
    where: { boardId },
    _max: { position: true },
  });
  const position = (maxPos._max.position ?? -1) + 1;

  const column = await prisma.column.create({
    data: { boardId, name, color, position },
  });

  notifyBoard(c, boardId, "board");
  return c.json(column, 201);
});

// POST /api/boards/:id/priorities - create a priority, appended as least urgent (edit-key protected)
boards.post("/:id/priorities", requireEditKey, async (c) => {
  const boardId = c.req.param("id");
  if (!boardId) return fail(c, 400, "MISSING_BOARD_ID", "Missing board id");
  const body = await c.req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const color = typeof body?.color === "string" ? body.color : "";

  if (!isValidPriorityName(name)) {
    return fail(c, 400, "PRIORITY_NAME_LENGTH", "Priority name must be 1-30 chars", { min: 1, max: 30 });
  }
  if (!isValidPaletteColor(color)) {
    return fail(c, 400, "INVALID_COLOR", "Invalid color");
  }

  const existing = await prisma.priority.findMany({
    where: { boardId },
    select: { name: true, position: true },
  });
  if (existing.length >= MAX_PRIORITIES) {
    return fail(c, 400, "BOARD_MAX_PRIORITIES", `A board can have at most ${MAX_PRIORITIES} priorities`, {
      max: MAX_PRIORITIES,
    });
  }
  if (existing.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
    return fail(c, 400, "PRIORITY_NAME_EXISTS", "A priority with this name already exists");
  }
  const position = existing.reduce((max, p) => Math.max(max, p.position), -1) + 1;

  const priority = await prisma.priority.create({
    data: { boardId, name, color, position },
  });

  notifyBoard(c, boardId, "board");
  return c.json(priority, 201);
});

// POST /api/boards/:id/tags - create (or return existing) tag for a board (edit-key protected)
boards.post("/:id/tags", requireEditKey, async (c) => {
  const boardId = c.req.param("id");
  if (!boardId) return fail(c, 400, "MISSING_BOARD_ID", "Missing board id");
  const body = await c.req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";

  if (!name || name.length > 50) {
    return fail(c, 400, "TAG_NAME_LENGTH", "Tag name must be 1-50 chars", { min: 1, max: 50 });
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
      return fail(c, 400, "BOARD_MAX_TAGS", "A board can have at most 5 tags", { max: 5 });
    }
  }

  const tag = await prisma.tag.upsert({
    where: { boardId_name: { boardId, name } },
    update: {},
    create: { boardId, name },
  });

  notifyBoard(c, boardId, "board");
  return c.json(tag, 201);
});
