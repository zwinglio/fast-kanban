<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { useRoute } from "vue-router";
import { getBoard, updateCard, verifyEditKey as apiVerifyEditKey, type Board, type Card, type Column, type Tag } from "../api";
import { getEditKey, setEditKey } from "../lib/editKey";
import ColumnComp from "../components/Column.vue";
import CardModal from "../components/CardModal.vue";
import BoardSettings from "../components/BoardSettings.vue";
import ThemeToggle from "../components/ThemeToggle.vue";

const route = useRoute();
const boardId = route.params.id as string;

const board = ref<Board | null>(null);
const loading = ref(true);
const loadError = ref("");

const boardColumns = ref<Column[]>([]);
const columns = reactive<Record<number, Card[]>>({});

const boardTags = ref<Tag[]>([]);
const activeTagIds = ref<Set<number>>(new Set());
const activeColumnIds = ref<Set<number>>(new Set());

const readOnly = ref(true);
const showNewKeyBanner = ref(route.query.newKey === "1");
const newKeyValue = ref(getEditKey(boardId) ?? "");
const copyLabel = ref("Copy");

const showKeyEntry = ref(false);
const keyInput = ref("");
const keyEntryError = ref("");
const keyEntryLoading = ref(false);

const showSettings = ref(false);

const modalState = ref<{ mode: "edit" | "create"; card: Card | null; columnId?: number } | null>(
  null
);

function fillColumns(cards: Card[]) {
  for (const col of boardColumns.value) {
    columns[col.id] = [];
  }
  for (const card of cards) {
    if (!columns[card.columnId]) columns[card.columnId] = [];
    columns[card.columnId].push(card);
  }
  for (const col of boardColumns.value) {
    if (columns[col.id]) {
      columns[col.id].sort((a, b) => a.position - b.position);
    }
  }
}

function cardCountsByColumn(): Record<number, number> {
  const counts: Record<number, number> = {};
  for (const col of boardColumns.value) {
    counts[col.id] = columns[col.id]?.length ?? 0;
  }
  return counts;
}

async function load() {
  loading.value = true;
  loadError.value = "";
  try {
    const data = await getBoard(boardId);
    board.value = data.board;
    boardColumns.value = data.columns ?? [];
    boardTags.value = data.tags ?? [];
    activeColumnIds.value = new Set(boardColumns.value.map((c) => c.id));
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

function openAddCard(columnId: number) {
  modalState.value = { mode: "create", card: null, columnId };
}

function closeModal() {
  modalState.value = null;
}

function onSaved(card: Card) {
  for (const col of boardColumns.value) {
    if (columns[col.id]) {
      columns[col.id] = columns[col.id].filter((c) => c.id !== card.id);
    }
  }
  if (!columns[card.columnId]) columns[card.columnId] = [];
  columns[card.columnId].push(card);
  columns[card.columnId].sort((a, b) => a.position - b.position);
  closeModal();
}

function onDeleted(id: number) {
  for (const col of boardColumns.value) {
    if (columns[col.id]) {
      columns[col.id] = columns[col.id].filter((c) => c.id !== id);
    }
  }
  closeModal();
}

function persistColumnOrder(columnId: number) {
  const colCards = columns[columnId];
  if (!colCards) return;
  colCards.forEach((card, idx) => {
    const changed = card.position !== idx || card.columnId !== columnId;
    card.position = idx;
    card.columnId = columnId;
    if (changed) {
      updateCard(boardId, card.id, { columnId, position: idx }).catch(() => {
        load();
      });
    }
  });
}

const filterActive = computed(
  () => activeTagIds.value.size > 0 || activeColumnIds.value.size < boardColumns.value.length
);

function cardMatchesFilters(card: Card): boolean {
  if (!activeColumnIds.value.has(card.columnId)) return false;
  if (activeTagIds.value.size === 0) return true;
  return (card.tags ?? []).some((t) => activeTagIds.value.has(t.id));
}

const filteredColumns = computed<Record<number, Card[]>>(() => {
  const out: Record<number, Card[]> = {};
  for (const col of boardColumns.value) {
    out[col.id] = (columns[col.id] ?? []).filter(cardMatchesFilters);
  }
  return out;
});

const totalMatching = computed(() =>
  boardColumns.value.reduce((sum, col) => sum + (filteredColumns.value[col.id]?.length ?? 0), 0)
);

function toggleTagFilter(id: number) {
  const next = new Set(activeTagIds.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  activeTagIds.value = next;
}

function toggleColumnFilter(id: number) {
  const next = new Set(activeColumnIds.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  activeColumnIds.value = next;
}

function clearFilters() {
  activeTagIds.value = new Set();
  activeColumnIds.value = new Set(boardColumns.value.map((c) => c.id));
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
  for (const col of boardColumns.value) {
    for (const card of columns[col.id] ?? []) {
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
  for (const col of boardColumns.value) {
    for (const card of columns[col.id] ?? []) {
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

async function onSettingsChanged() {
  await load();
}
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
          <button v-if="!readOnly" class="icon-btn" type="button" title="Board settings" @click="showSettings = true">
            ⚙️
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
            <span class="filter-label">Columns</span>
            <div class="filter-chips">
              <button
                v-for="col in boardColumns"
                :key="col.id"
                type="button"
                class="status-chip"
                :style="activeColumnIds.has(col.id) ? { background: col.color, borderColor: 'transparent', color: '#fff' } : {}"
                @click="toggleColumnFilter(col.id)"
              >
                {{ col.name }}
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
        <ColumnComp
          v-for="col in boardColumns"
          v-show="activeColumnIds.has(col.id)"
          :key="col.id"
          :title="col.name"
          :color="col.color"
          :column-id="col.id"
          :cards="filterActive ? (filteredColumns[col.id] ?? []) : (columns[col.id] ?? [])"
          :prefix="board.prefix"
          :read-only="readOnly"
          :disable-drag="filterActive"
          @change="persistColumnOrder(col.id)"
          @open="openCard"
          @add-card="openAddCard(col.id)"
        />
      </div>

      <CardModal
        v-if="modalState"
        :board-id="boardId"
        :prefix="board.prefix"
        :read-only="readOnly"
        :card="modalState.card"
        :initial-column-id="modalState.columnId"
        :board-tags="boardTags"
        :board-columns="boardColumns"
        @close="closeModal"
        @saved="onSaved"
        @deleted="onDeleted"
        @tag-created="onTagCreated"
        @tag-renamed="onTagRenamed"
        @tag-deleted="onTagDeleted"
      />

      <BoardSettings
        v-if="showSettings"
        :board-id="boardId"
        :columns="boardColumns"
        :card-counts="cardCountsByColumn()"
        @close="showSettings = false"
        @changed="onSettingsChanged"
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
