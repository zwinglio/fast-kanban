import { Hono } from "hono";
import { prisma } from "../db.js";
import { notifyBoard } from "../live.js";
import { verifyEditKey } from "../auth.js";
import { MAX_COMMENT_LENGTH, commentExcerpt, parseCommentBody } from "../comments.js";
import { fail, type ErrorCode } from "../errors.js";
import { eventRows } from "../events.js";

export const comments = new Hono();

/** Edit-key auth failure that routes turn into `fail(c, status, code, error)`. */
function editKeyFailure(status: 401 | 404, code: ErrorCode, error: string) {
  return { ok: false as const, status, code, error };
}

async function requireCommentEditKey(commentId: number, key: string | undefined) {
  if (!key) return editKeyFailure(401, "MISSING_EDIT_KEY", "Missing edit key");
  const comment = await prisma.cardComment.findUnique({ where: { id: commentId } });
  if (!comment) return editKeyFailure(404, "COMMENT_NOT_FOUND", "Comment not found");
  const board = await prisma.board.findUnique({ where: { id: comment.boardId } });
  if (!board) return editKeyFailure(404, "BOARD_NOT_FOUND", "Board not found");
  const valid = await verifyEditKey(key, board.editHash);
  if (!valid) return editKeyFailure(401, "INVALID_EDIT_KEY", "Invalid edit key");
  return { ok: true as const, comment };
}

// PATCH /api/comments/:id { body } - edit a comment's text
comments.patch("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id)) return fail(c, 400, "INVALID_COMMENT_ID", "Invalid comment id");

  const check = await requireCommentEditKey(id, c.req.header("X-Edit-Key"));
  if (!check.ok) return fail(c, check.status, check.code, check.error);

  const payload = await c.req.json().catch(() => null);
  const body = parseCommentBody(payload?.body);
  if (body === null) {
    return fail(c, 400, "COMMENT_LENGTH", `Comment must be 1-${MAX_COMMENT_LENGTH} characters`, {
      max: MAX_COMMENT_LENGTH,
    });
  }
  if (body === check.comment.body) return c.json(check.comment);

  const { cardId, boardId, author } = check.comment;
  const [updated] = await prisma.$transaction([
    prisma.cardComment.update({ where: { id }, data: { body } }),
    prisma.cardEvent.createMany({
      data: eventRows(cardId, boardId, [
        { type: "comment", data: { action: "edited", author, excerpt: commentExcerpt(body) } },
      ]),
    }),
  ]);
  notifyBoard(c, boardId, "card", cardId);
  return c.json(updated);
});

// DELETE /api/comments/:id
comments.delete("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id)) return fail(c, 400, "INVALID_COMMENT_ID", "Invalid comment id");

  const check = await requireCommentEditKey(id, c.req.header("X-Edit-Key"));
  if (!check.ok) return fail(c, check.status, check.code, check.error);

  const { cardId, boardId, author, body } = check.comment;
  await prisma.$transaction([
    prisma.cardComment.delete({ where: { id } }),
    prisma.cardEvent.createMany({
      data: eventRows(cardId, boardId, [
        { type: "comment", data: { action: "deleted", author, excerpt: commentExcerpt(body) } },
      ]),
    }),
  ]);
  notifyBoard(c, boardId, "card", cardId);
  return c.json({ ok: true });
});
