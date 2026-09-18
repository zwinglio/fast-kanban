import { Hono } from "hono";
import { prisma } from "../db.js";
import { verifyEditKey } from "../auth.js";
import { MAX_COMMENT_LENGTH, commentExcerpt, parseCommentBody } from "../comments.js";
import { eventRows } from "../events.js";

export const comments = new Hono();

async function requireCommentEditKey(commentId: number, key: string | undefined) {
  if (!key) return { ok: false as const, status: 401 as const, error: "Missing edit key" };
  const comment = await prisma.cardComment.findUnique({ where: { id: commentId } });
  if (!comment) return { ok: false as const, status: 404 as const, error: "Comment not found" };
  const board = await prisma.board.findUnique({ where: { id: comment.boardId } });
  if (!board) return { ok: false as const, status: 404 as const, error: "Board not found" };
  const valid = await verifyEditKey(key, board.editHash);
  if (!valid) return { ok: false as const, status: 401 as const, error: "Invalid edit key" };
  return { ok: true as const, comment };
}

// PATCH /api/comments/:id { body } - edit a comment's text
comments.patch("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id)) return c.json({ error: "Invalid comment id" }, 400);

  const check = await requireCommentEditKey(id, c.req.header("X-Edit-Key"));
  if (!check.ok) return c.json({ error: check.error }, check.status);

  const payload = await c.req.json().catch(() => null);
  const body = parseCommentBody(payload?.body);
  if (body === null) return c.json({ error: `Comment must be 1-${MAX_COMMENT_LENGTH} characters` }, 400);
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
  return c.json(updated);
});

// DELETE /api/comments/:id
comments.delete("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id)) return c.json({ error: "Invalid comment id" }, 400);

  const check = await requireCommentEditKey(id, c.req.header("X-Edit-Key"));
  if (!check.ok) return c.json({ error: check.error }, check.status);

  const { cardId, boardId, author, body } = check.comment;
  await prisma.$transaction([
    prisma.cardComment.delete({ where: { id } }),
    prisma.cardEvent.createMany({
      data: eventRows(cardId, boardId, [
        { type: "comment", data: { action: "deleted", author, excerpt: commentExcerpt(body) } },
      ]),
    }),
  ]);
  return c.json({ ok: true });
});
