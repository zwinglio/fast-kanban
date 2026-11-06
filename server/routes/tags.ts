import { Hono } from "hono";
import { prisma } from "../db.js";
import { notifyBoard } from "../live.js";
import { verifyEditKey } from "../auth.js";
import { fail, type ErrorCode } from "../errors.js";
import { eventRows } from "../events.js";

export const tags = new Hono();

/** Edit-key auth failure that routes turn into `fail(c, status, code, error)`. */
function editKeyFailure(status: 401 | 404, code: ErrorCode, error: string) {
  return { ok: false as const, status, code, error };
}

async function requireTagEditKey(tagId: number, key: string | undefined) {
  if (!key) return editKeyFailure(401, "MISSING_EDIT_KEY", "Missing edit key");
  const tag = await prisma.tag.findUnique({ where: { id: tagId } });
  if (!tag) return editKeyFailure(404, "TAG_NOT_FOUND", "Tag not found");
  const board = await prisma.board.findUnique({ where: { id: tag.boardId } });
  if (!board) return editKeyFailure(404, "BOARD_NOT_FOUND", "Board not found");
  const valid = await verifyEditKey(key, board.editHash);
  if (!valid) return editKeyFailure(401, "INVALID_EDIT_KEY", "Invalid edit key");
  return { ok: true as const, tag };
}

// PATCH /api/tags/:id - rename a tag
tags.patch("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id)) return fail(c, 400, "INVALID_TAG_ID", "Invalid tag id");

  const check = await requireTagEditKey(id, c.req.header("X-Edit-Key"));
  if (!check.ok) return fail(c, check.status, check.code, check.error);

  const body = await c.req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 50) {
    return fail(c, 400, "TAG_NAME_LENGTH", "Tag name must be 1-50 chars", { min: 1, max: 50 });
  }

  const existing = await prisma.tag.findUnique({
    where: { boardId_name: { boardId: check.tag.boardId, name } },
    select: { id: true },
  });
  if (existing && existing.id !== id) {
    return fail(c, 400, "TAG_NAME_EXISTS", "A tag with this name already exists");
  }

  const tag = await prisma.tag.update({ where: { id }, data: { name } });
  notifyBoard(c, check.tag.boardId, "board");
  return c.json(tag);
});

// DELETE /api/tags/:id - detach a tag from all cards and remove it from the board
tags.delete("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id)) return fail(c, 400, "INVALID_TAG_ID", "Invalid tag id");

  const check = await requireTagEditKey(id, c.req.header("X-Edit-Key"));
  if (!check.ok) return fail(c, check.status, check.code, check.error);

  const affected = await prisma.card.findMany({ where: { tags: { some: { id } } }, select: { id: true } });
  await prisma.$transaction([
    prisma.tag.delete({ where: { id } }),
    prisma.cardEvent.createMany({
      data: affected.flatMap((card) =>
        eventRows(card.id, check.tag.boardId, [
          { type: "tags", data: { added: [], removed: [check.tag.name], reason: "deleted" } },
        ])
      ),
    }),
  ]);
  notifyBoard(c, check.tag.boardId, "board");
  return c.json({ ok: true });
});
