import { Hono } from "hono";
import { customAlphabet } from "nanoid";
import type { Prisma } from "@prisma/client";
import { prisma } from "../db.js";
import { hashEditKey, isValidPrefix, requireEditKey, verifyEditKey } from "../auth.js";

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
    data: { id, title, prefix, editHash },
  });

  return c.json({ id, editKey }, 201);
});

// GET /api/boards/:id - fetch board + cards
boards.get("/:id", async (c) => {
  const id = c.req.param("id");
  const board = await prisma.board.findUnique({ where: { id } });
  if (!board) return c.json({ error: "Board not found" }, 404);

  const cards = await prisma.card.findMany({
    where: { boardId: id },
    orderBy: [{ status: "asc" }, { position: "asc" }],
  });

  return c.json({
    board: { id: board.id, title: board.title, prefix: board.prefix },
    cards,
  });
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
  const status = typeof body?.status === "string" ? body.status : "backlog";

  if (!title || title.length > 255) {
    return c.json({ error: "Title is required (max 255 chars)" }, 400);
  }
  const validStatuses = ["backlog", "todo", "doing", "done"];
  if (!validStatuses.includes(status)) {
    return c.json({ error: "Invalid status" }, 400);
  }

  const card = await prisma.$transaction(async (tx) => {
    const updatedBoard = await tx.board.update({
      where: { id: boardId },
      data: { nextSeq: { increment: 1 } },
    });
    const seq = updatedBoard.nextSeq - 1;

    const last = await tx.card.findFirst({
      where: { boardId, status: status as any },
      orderBy: { position: "desc" },
    });
    const position = last ? last.position + 1 : 0;

    const data: Prisma.CardUncheckedCreateInput = {
      boardId,
      seq,
      title,
      body: cardBody,
      status: status as Prisma.CardUncheckedCreateInput["status"],
      position,
    };
    return tx.card.create({ data });
  });

  return c.json(card, 201);
});
