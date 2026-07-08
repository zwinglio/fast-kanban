import { getEditKey } from "./lib/editKey";

export interface Tag {
  id: number;
  boardId: string;
  name: string;
}

export interface Column {
  id: number;
  boardId: string;
  name: string;
  color: string;
  position: number;
}

export interface Card {
  id: number;
  boardId: string;
  seq: number;
  title: string;
  body: string | null;
  columnId: number;
  position: number;
  tags: Tag[];
  createdAt: string;
  updatedAt: string;
}

export interface Board {
  id: string;
  title: string;
  prefix: string;
}

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  boardId?: string
): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body) headers.set("Content-Type", "application/json");
  if (boardId) {
    const key = getEditKey(boardId);
    if (key) headers.set("X-Edit-Key", key);
  }

  const res = await fetch(`/api${path}`, { ...options, headers });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(res.status, data?.error ?? `Request failed (${res.status})`);
  }
  return data as T;
}

export function createBoard(title: string, prefix: string) {
  return request<{ id: string; editKey: string }>("/boards", {
    method: "POST",
    body: JSON.stringify({ title, prefix }),
  });
}

export function getBoard(id: string) {
  return request<{ board: Board; cards: Card[]; tags: Tag[]; columns: Column[] }>(`/boards/${id}`);
}

export function verifyEditKey(id: string, key: string) {
  return request<{ valid: boolean }>(`/boards/${id}/verify`, {
    headers: { "X-Edit-Key": key },
  });
}

export function createCard(
  boardId: string,
  payload: { title: string; body?: string; columnId?: number; tagIds?: number[] }
) {
  return request<Card>(`/boards/${boardId}/cards`, {
    method: "POST",
    body: JSON.stringify(payload),
  }, boardId);
}

export function updateCard(
  boardId: string,
  cardId: number,
  payload: Partial<{ title: string; body: string | null; columnId: number; position: number; tagIds: number[] }>
) {
  return request<Card>(`/cards/${cardId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  }, boardId);
}

export function deleteCard(boardId: string, cardId: number) {
  return request<{ ok: true }>(`/cards/${cardId}`, { method: "DELETE" }, boardId);
}

export function createTag(boardId: string, name: string) {
  return request<Tag>(`/boards/${boardId}/tags`, {
    method: "POST",
    body: JSON.stringify({ name }),
  }, boardId);
}

export function deleteTag(boardId: string, tagId: number) {
  return request<{ ok: true }>(`/tags/${tagId}`, { method: "DELETE" }, boardId);
}

export function renameTag(boardId: string, tagId: number, name: string) {
  return request<Tag>(`/tags/${tagId}`, {
    method: "PATCH",
    body: JSON.stringify({ name }),
  }, boardId);
}

export function createColumn(boardId: string, name: string, color: string) {
  return request<Column>(`/boards/${boardId}/columns`, {
    method: "POST",
    body: JSON.stringify({ name, color }),
  }, boardId);
}

export function updateColumn(boardId: string, columnId: number, patch: Partial<{ name: string; color: string; position: number }>) {
  return request<Column>(`/columns/${columnId}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  }, boardId);
}

export function deleteColumn(boardId: string, columnId: number) {
  return request<{ ok: true }>(`/columns/${columnId}`, { method: "DELETE" }, boardId);
}

export { ApiError };
