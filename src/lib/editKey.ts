const storageKey = (boardId: string) => `fk_editkey_${boardId}`;

export function getEditKey(boardId: string): string | null {
  return localStorage.getItem(storageKey(boardId));
}

export function setEditKey(boardId: string, key: string): void {
  localStorage.setItem(storageKey(boardId), key);
}

export function clearEditKey(boardId: string): void {
  localStorage.removeItem(storageKey(boardId));
}
