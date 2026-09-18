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

export interface Priority {
  id: number;
  boardId: string;
  name: string;
  color: string;
  position: number; // 0 = most urgent
}

export interface Card {
  id: number;
  boardId: string;
  seq: number;
  title: string;
  body: string | null;
  columnId: number;
  priorityId: number | null;
  points: number | null; // story points; null = not estimated
  position: number;
  archivedAt: string | null;
  tags: Tag[];
  createdAt: string;
  updatedAt: string;
}

export interface Board {
  id: string;
  title: string;
  prefix: string;
  nextSeq: number; // number the next created card will get
  pointsEnabled: boolean; // story points are opt-in per board
  dependenciesEnabled: boolean; // "blocked by" links are opt-in per board
}

/** blockedId is blocked by blockerId (equivalently: blockerId blocks blockedId). */
export interface Dependency {
  blockedId: number;
  blockerId: number;
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

export function createBoard(title: string, prefix: string, startAt?: number) {
  return request<{ id: string; editKey: string }>("/boards", {
    method: "POST",
    body: JSON.stringify({ title, prefix, ...(startAt !== undefined ? { startAt } : {}) }),
  });
}

export function getBoard(id: string) {
  return request<{ board: Board; cards: Card[]; tags: Tag[]; columns: Column[]; priorities: Priority[]; dependencies: Dependency[] }>(`/boards/${id}`);
}

export function updateBoard(
  boardId: string,
  patch: Partial<{ title: string; nextSeq: number; pointsEnabled: boolean; dependenciesEnabled: boolean }>
) {
  return request<Board>(`/boards/${boardId}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  }, boardId);
}

export function verifyEditKey(id: string, key: string) {
  return request<{ valid: boolean }>(`/boards/${id}/verify`, {
    headers: { "X-Edit-Key": key },
  });
}

export function createCard(
  boardId: string,
  payload: {
    title: string;
    body?: string;
    columnId?: number;
    priorityId?: number | null;
    points?: number | null;
    tagIds?: number[];
  }
) {
  return request<Card>(`/boards/${boardId}/cards`, {
    method: "POST",
    body: JSON.stringify(payload),
  }, boardId);
}

export function updateCard(
  boardId: string,
  cardId: number,
  payload: Partial<{
    title: string;
    body: string | null;
    columnId: number;
    priorityId: number | null;
    points: number | null;
    position: number;
    tagIds: number[];
    archived: boolean;
  }>
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

export type CardEvent =
  | { id: number; createdAt: string; type: "created"; data: { column: string } }
  | { id: number; createdAt: string; type: "moved"; data: { from: string; to: string } }
  | { id: number; createdAt: string; type: "title"; data: { from: string; to: string } }
  | { id: number; createdAt: string; type: "description"; data: null }
  | { id: number; createdAt: string; type: "priority"; data: { from: string | null; to: string | null } }
  | { id: number; createdAt: string; type: "tags"; data: { added: string[]; removed: string[] } }
  | { id: number; createdAt: string; type: "points"; data: { from: number | null; to: number | null } }
  | {
      id: number;
      createdAt: string;
      type: "dependency";
      data: { action: "added" | "removed"; role: "blocked_by" | "blocks"; card: string; title: string };
    }
  | { id: number; createdAt: string; type: "archived" | "restored"; data: null };

export function getCardEvents(cardId: number, opts: { limit?: number; before?: number } = {}) {
  const params = new URLSearchParams();
  if (opts.limit) params.set("limit", String(opts.limit));
  if (opts.before !== undefined) params.set("before", String(opts.before));
  const qs = params.toString();
  return request<{ events: CardEvent[]; hasMore: boolean; total: number }>(
    `/cards/${cardId}/events${qs ? `?${qs}` : ""}`
  );
}

export function addDependency(boardId: string, blockedId: number, blockerId: number) {
  return request<Dependency>(`/cards/${blockedId}/dependencies`, {
    method: "POST",
    body: JSON.stringify({ blockerId }),
  }, boardId);
}

export function removeDependency(boardId: string, blockedId: number, blockerId: number) {
  return request<{ ok: true }>(`/cards/${blockedId}/dependencies/${blockerId}`, { method: "DELETE" }, boardId);
}

export function createPriority(boardId: string, name: string, color: string) {
  return request<Priority>(`/boards/${boardId}/priorities`, {
    method: "POST",
    body: JSON.stringify({ name, color }),
  }, boardId);
}

export function updatePriority(
  boardId: string,
  priorityId: number,
  patch: Partial<{ name: string; color: string; position: number }>
) {
  return request<Priority>(`/priorities/${priorityId}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  }, boardId);
}

export function deletePriority(boardId: string, priorityId: number) {
  return request<{ ok: true }>(`/priorities/${priorityId}`, { method: "DELETE" }, boardId);
}

export { ApiError };
