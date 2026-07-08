<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { useRoute } from "vue-router";
import { getBoard, updateCard, verifyEditKey as apiVerifyEditKey, type Board, type Card, type CardStatus, type Tag } from "../api";
import { getEditKey, setEditKey } from "../lib/editKey";
import Column from "../components/Column.vue";
import CardModal from "../components/CardModal.vue";
import ThemeToggle from "../components/ThemeToggle.vue";

const route = useRoute();
const boardId = route.params.id as string;

const board = ref<Board | null>(null);
const loading = ref(true);
const loadError = ref("");

const STATUSES: { key: CardStatus; label: string }[] = [
  { key: "backlog", label: "Backlog" },
  { key: "todo", label: "Todo" },
  { key: "doing", label: "Doing" },
  { key: "done", label: "Done" },
];

const columns = reactive<Record<CardStatus, Card[]>>({
  backlog: [],
  todo: [],
  doing: [],
  done: [],
});

const boardTags = ref<Tag[]>([]);
const activeTagIds = ref<Set<number>>(new Set());
const activeStatuses = ref<Set<CardStatus>>(new Set(STATUSES.map((s) => s.key)));

const readOnly = ref(true);
const showNewKeyBanner = ref(route.query.newKey === "1");
const newKeyValue = ref(getEditKey(boardId) ?? "");
const copyLabel = ref("Copy");

const showKeyEntry = ref(false);
const keyInput = ref("");
const keyEntryError = ref("");
const keyEntryLoading = ref(false);

const modalState = ref<{ mode: "edit" | "create"; card: Card | null; status?: CardStatus } | null>(
  null
);

function fillColumns(cards: Card[]) {
  for (const s of STATUSES) columns[s.key] = [];
  for (const card of cards) {
    columns[card.status].push(card);
  }
  for (const s of STATUSES) {
    columns[s.key].sort((a, b) => a.position - b.position);
  }
}

async function load() {
  loading.value = true;
  loadError.value = "";
  try {
    const data = await getBoard(boardId);
    board.value = data.board;
    boardTags.value = data.tags ?? [];
    fillColumns(data.cards);
    document.title = `${data.board.title} - Fast Kanban`;
  } catch (e) {
    loadError.value = "Board not found.";
    document.title = "Fast Kanban";
  } finally {
    loading.value = false;
  }
}

async function checkEditAccess() {
  const key = getEditKey(boardId);
  if (!key) {
    readOnly.value = true;
    return;
  }
  try {
    const { valid } = await apiVerifyEditKey(boardId, key);
    readOnly.value = !valid;
  } catch {
    readOnly.value = true;
  }
}

onMounted(async () => {
  await load();
  await checkEditAccess();
});

function openCard(card: Card) {
  modalState.value = { mode: "edit", card };
}

function openAddCard(status: CardStatus) {
  modalState.value = { mode: "create", card: null, status };
}

function closeModal() {
  modalState.value = null;
}

function onSaved(card: Card) {
  for (const s of STATUSES) {
    columns[s.key] = columns[s.key].filter((c) => c.id !== card.id);
  }
  columns[card.status].push(card);
  columns[card.status].sort((a, b) => a.position - b.position);
  closeModal();
}

function onDeleted(id: number) {
  for (const s of STATUSES) {
    columns[s.key] = columns[s.key].filter((c) => c.id !== id);
  }
  closeModal();
}

function persistColumnOrder(status: CardStatus) {
  columns[status].forEach((card, idx) => {
    const changed = card.position !== idx || card.status !== status;
    card.position = idx;
    card.status = status;
    if (changed) {
      updateCard(boardId, card.id, { status, position: idx }).catch(() => {
        // Best-effort; reload to resync on failure.
        load();
      });
    }
  });
}

const filterActive = computed(
  () => activeTagIds.value.size > 0 || activeStatuses.value.size < STATUSES.length
);

function cardMatchesFilters(card: Card): boolean {
  if (!activeStatuses.value.has(card.status)) return false;
  if (activeTagIds.value.size === 0) return true;
  return (card.tags ?? []).some((t) => activeTagIds.value.has(t.id));
}

const filteredColumns = computed<Record<CardStatus, Card[]>>(() => {
  const out: Record<CardStatus, Card[]> = { backlog: [], todo: [], doing: [], done: [] };
  for (const s of STATUSES) {
    out[s.key] = columns[s.key].filter(cardMatchesFilters);
  }
  return out;
});

const totalMatching = computed(() =>
  STATUSES.reduce((sum, s) => sum + filteredColumns.value[s.key].length, 0)
);

function toggleTagFilter(id: number) {
  const next = new Set(activeTagIds.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  activeTagIds.value = next;
}

function toggleStatusFilter(key: CardStatus) {
  const next = new Set(activeStatuses.value);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  activeStatuses.value = next;
}

function clearFilters() {
  activeTagIds.value = new Set();
  activeStatuses.value = new Set(STATUSES.map((s) => s.key));
}

function onTagCreated(tag: Tag) {
  if (!boardTags.value.some((t) => t.id === tag.id)) {
    boardTags.value = [...boardTags.value, tag].sort((a, b) => a.name.localeCompare(b.name));
  }
}

function onTagRenamed(tag: Tag) {
  boardTags.value = boardTags.value
    .map((t) => (t.id === tag.id ? tag : t))
    .sort((a, b) => a.name.localeCompare(b.name));
  for (const s of STATUSES) {
    for (const card of columns[s.key]) {
      card.tags = card.tags.map((t) => (t.id === tag.id ? tag : t));
    }
  }
}

function onTagDeleted(id: number) {
  boardTags.value = boardTags.value.filter((t) => t.id !== id);
  if (activeTagIds.value.has(id)) {
    const next = new Set(activeTagIds.value);
    next.delete(id);
    activeTagIds.value = next;
  }
  for (const s of STATUSES) {
    for (const card of columns[s.key]) {
      card.tags = card.tags.filter((t) => t.id !== id);
    }
  }
}

async function copyKey() {
  try {
    await navigator.clipboard.writeText(newKeyValue.value);
    copyLabel.value = "Copied!";
    setTimeout(() => (copyLabel.value = "Copy"), 1500);
  } catch {
    // Clipboard API unavailable; user can select manually.
  }
}

function dismissBanner() {
  showNewKeyBanner.value = false;
}

async function submitKeyEntry() {
  keyEntryError.value = "";
  const key = keyInput.value.trim();
  if (!key) return;
  keyEntryLoading.value = true;
  try {
    const { valid } = await apiVerifyEditKey(boardId, key);
    if (!valid) {
      keyEntryError.value = "Invalid edit key.";
      return;
    }
    setEditKey(boardId, key);
    readOnly.value = false;
    showKeyEntry.value = false;
    keyInput.value = "";
  } catch {
    keyEntryError.value = "Could not verify key.";
  } finally {
    keyEntryLoading.value = false;
  }
}

const shareUrl = computed(() => window.location.href);
</script>

<template>
  <div class="board-page">
    <div v-if="loading" class="status-msg">Loading board...</div>
    <div v-else-if="loadError" class="status-msg">{{ loadError }}</div>
    <template v-else-if="board">
      <header class="board-header">
        <div>
          <h1>{{ board.title }}</h1>
          <span class="prefix-badge">{{ board.prefix }}</span>
        </div>
        <div class="header-actions">
          <span v-if="readOnly" class="read-only-badge">Read-only</span>
          <button v-if="readOnly" class="btn secondary" @click="showKeyEntry = true">
            Enter edit key
          </button>
          <ThemeToggle />
        </div>
      </header>

      <div v-if="showNewKeyBanner" class="key-banner">
        <div>
          <strong>Save your edit key!</strong> You'll need it to make changes later. It won't be shown again.
          <div class="key-value">{{ newKeyValue }}</div>
        </div>
        <div class="key-banner-actions">
          <button class="btn secondary small" @click="copyKey">{{ copyLabel }}</button>
          <button class="btn secondary small" @click="dismissBanner">Dismiss</button>
        </div>
      </div>

      <div v-if="showKeyEntry" class="key-entry-overlay" @click.self="showKeyEntry = false">
        <div class="key-entry-box">
          <h3>Enter edit key</h3>
          <input
            v-model="keyInput"
            type="text"
            placeholder="Paste your edit key"
            @keyup.enter="submitKeyEntry"
          />
          <p v-if="keyEntryError" class="error">{{ keyEntryError }}</p>
          <div class="key-entry-actions">
            <button class="btn secondary" @click="showKeyEntry = false">Cancel</button>
            <button class="btn" :disabled="keyEntryLoading" @click="submitKeyEntry">
              {{ keyEntryLoading ? "Checking..." : "Unlock editing" }}
            </button>
          </div>
        </div>
      </div>

      <div class="filter-bar">
        <div class="filter-inner">
          <div v-if="boardTags.length" class="filter-group">
            <span class="filter-label">Tags</span>
            <div class="filter-chips">
              <button
                v-for="tag in boardTags"
                :key="tag.id"
                type="button"
                class="tag-chip selectable"
                :class="{ active: activeTagIds.has(tag.id) }"
                @click="toggleTagFilter(tag.id)"
              >
                {{ tag.name }}
              </button>
            </div>
          </div>
          <div v-if="boardTags.length" class="filter-divider" />
          <div class="filter-group">
            <span class="filter-label">Status</span>
            <div class="filter-chips">
              <button
                v-for="s in STATUSES"
                :key="s.key"
                type="button"
                class="status-chip"
                :class="[`status-${s.key}`, { active: activeStatuses.has(s.key) }]"
                @click="toggleStatusFilter(s.key)"
              >
                {{ s.label }}
              </button>
            </div>
          </div>
        </div>
        <div class="filter-actions">
          <span class="filter-count" :class="{ dimmed: !filterActive }">
            {{ filterActive ? `${totalMatching} shown` : `${totalMatching} cards` }}
          </span>
          <button
            v-if="filterActive"
            class="btn secondary small"
            type="button"
            @click="clearFilters"
          >
            Clear filters
          </button>
        </div>
      </div>

      <div class="columns">
        <Column
          v-for="s in STATUSES"
          v-show="activeStatuses.has(s.key)"
          :key="s.key"
          :title="s.label"
          :status="s.key"
          :cards="filterActive ? filteredColumns[s.key] : columns[s.key]"
          :prefix="board.prefix"
          :read-only="readOnly"
          :disable-drag="filterActive"
          @change="persistColumnOrder(s.key)"
          @open="openCard"
          @add-card="openAddCard(s.key)"
        />
      </div>

      <CardModal
        v-if="modalState"
        :board-id="boardId"
        :prefix="board.prefix"
        :read-only="readOnly"
        :card="modalState.card"
        :initial-status="modalState.status"
        :board-tags="boardTags"
        @close="closeModal"
        @saved="onSaved"
        @deleted="onDeleted"
        @tag-created="onTagCreated"
        @tag-renamed="onTagRenamed"
        @tag-deleted="onTagDeleted"
      />
    </template>
  </div>
</template>

<style scoped>
.board-page {
  min-height: 100vh;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.filter-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 14px;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 8px;
}

.filter-inner {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 14px;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.filter-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--muted);
  white-space: nowrap;
}

.filter-divider {
  width: 1px;
  height: 20px;
  background: var(--border);
}

.filter-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.status-chip {
  border: 1px solid var(--border);
  background: transparent;
  color: var(--muted);
  border-radius: 12px;
  padding: 2px 10px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.12s ease;
}

.status-chip:hover {
  border-color: var(--muted);
}

.status-chip.active {
  color: #fff;
  border-color: transparent;
}

.status-chip.active.status-backlog { background: var(--status-backlog); }
.status-chip.active.status-todo { background: var(--status-todo); }
.status-chip.active.status-doing { background: var(--status-doing); }
.status-chip.active.status-done { background: var(--status-done); }

.filter-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-left: auto;
}

.filter-count {
  font-size: 13px;
  color: var(--muted);
  white-space: nowrap;
}

.filter-count.dimmed {
  opacity: 0.6;
}

.status-msg {
  padding: 48px;
  text-align: center;
  color: var(--muted);
}

.board-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.board-header h1 {
  margin: 0 0 4px;
  display: inline;
}

.prefix-badge {
  margin-left: 10px;
  background: var(--badge-bg);
  border-radius: 4px;
  padding: 2px 8px;
  font-size: 12px;
  font-weight: 700;
  color: var(--muted);
  vertical-align: middle;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.read-only-badge {
  background: var(--warning-bg);
  color: var(--warning-text);
  border-radius: 4px;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 600;
}

.key-banner {
  background: var(--success-bg);
  border: 1px solid var(--success-border);
  border-radius: 6px;
  padding: 14px 18px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}

.key-value {
  margin-top: 6px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 15px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 6px 10px;
  display: inline-block;
  user-select: all;
}

.key-banner-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.btn.small {
  padding: 4px 10px;
  font-size: 12px;
}

.key-entry-overlay {
  position: fixed;
  inset: 0;
  background: var(--overlay-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.key-entry-box {
  background: var(--panel);
  border-radius: 8px;
  padding: 24px;
  width: 100%;
  max-width: 360px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.key-entry-box input {
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 4px;
}

.key-entry-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.error {
  color: var(--danger);
  font-size: 13px;
  margin: 0;
}

.columns {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  overflow-x: auto;
  flex: 1;
}
</style>
