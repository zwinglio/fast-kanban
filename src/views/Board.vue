<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { useRoute } from "vue-router";
import { getBoard, updateCard, verifyEditKey as apiVerifyEditKey, type Board, type Card, type Column, type Tag } from "../api";
import { getEditKey, setEditKey } from "../lib/editKey";
import { rememberBoard } from "../lib/recentBoards";
import ColumnComp from "../components/Column.vue";
import CardModal from "../components/CardModal.vue";
import BoardSettings from "../components/BoardSettings.vue";
import TagsSettings from "../components/TagsSettings.vue";
import GeneralSettings from "../components/GeneralSettings.vue";
import FilterBar from "../components/FilterBar.vue";
import BoardHeader from "../components/BoardHeader.vue";
import ModalShell from "../components/ModalShell.vue";
import { getDensity, setDensity, type Density } from "../lib/density";

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

const activePanel = ref<"columns" | "tags" | "general" | null>(null);
const density = ref<Density>(getDensity(boardId));

const vFocus = { mounted: (el: HTMLElement) => el.focus() };

function onDensityChange(next: Density) {
  density.value = next;
  setDensity(boardId, next);
}

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
  if (board.value) {
    rememberBoard({ id: boardId, title: board.value.title, hasKey: !readOnly.value });
  }
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

const totalCards = computed(() =>
  boardColumns.value.reduce((sum, col) => sum + (columns[col.id]?.length ?? 0), 0)
);

const totalMatching = computed(() =>
  boardColumns.value.reduce((sum, col) => sum + (filteredColumns.value[col.id]?.length ?? 0), 0)
);

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
    rememberBoard({ id: boardId, title: board.value?.title ?? "", hasKey: true });
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

function onBoardSaved(updated: Board) {
  if (board.value) {
    board.value = updated;
    document.title = `${updated.title} - Fast Kanban`;
  }
  activePanel.value = null;
}
</script>

<template>
  <div class="board-page">
    <div v-if="loading" class="status-msg">Loading board...</div>
    <div v-else-if="loadError" class="status-msg">{{ loadError }}</div>
    <template v-else-if="board">
      <BoardHeader
        :board-id="boardId"
        :title="board.title"
        :prefix="board.prefix"
        :read-only="readOnly"
        :card-count="totalCards"
        :column-count="boardColumns.length"
        :tag-count="boardTags.length"
        @enter-key="showKeyEntry = true"
        @open-columns="activePanel = 'columns'"
        @open-tags="activePanel = 'tags'"
        @open-general="activePanel = 'general'"
      />

      <div v-if="showNewKeyBanner" class="key-banner" role="status">
        <span class="key-banner-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="8" cy="15" r="4" />
            <path d="M10.8 12.2L20 3M17 6l3 3M15 8l2 2" />
          </svg>
        </span>
        <div class="key-banner-text">
          <strong>Save your edit key</strong>
          <span>You'll need it to make changes from another browser. It won't be shown again.</span>
          <code class="key-value">{{ newKeyValue }}</code>
        </div>
        <div class="key-banner-actions">
          <button class="btn" type="button" @click="copyKey">{{ copyLabel }}</button>
          <button class="btn secondary" type="button" @click="dismissBanner">Dismiss</button>
        </div>
      </div>

      <ModalShell
        v-if="showKeyEntry"
        title="Enter edit key"
        subtitle="Paste the key you got when this board was created."
        :width="420"
        @close="showKeyEntry = false"
      >
        <input
          v-model="keyInput"
          v-focus
          type="text"
          class="sheet-input key-input"
          placeholder="Paste your edit key"
          aria-label="Edit key"
          @keydown.enter.prevent="submitKeyEntry"
        />
        <p v-if="keyEntryError" class="sheet-error">{{ keyEntryError }}</p>
        <template #footer>
          <button class="btn secondary" type="button" @click="showKeyEntry = false">Cancel</button>
          <button class="btn" type="button" :disabled="keyEntryLoading" @click="submitKeyEntry">
            {{ keyEntryLoading ? "Checking..." : "Unlock editing" }}
          </button>
        </template>
      </ModalShell>

      <FilterBar
        v-model:tag-ids="activeTagIds"
        v-model:column-ids="activeColumnIds"
        :tags="boardTags"
        :columns="boardColumns"
        :card-counts="cardCountsByColumn()"
        :shown-count="totalMatching"
        :total-count="totalCards"
        :filter-active="filterActive"
      />

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
          :density="density"
          @change="persistColumnOrder(col.id)"
          @open="openCard"
          @add-card="openAddCard(col.id)"
        />
      </div>

      <CardModal
        v-if="modalState"
        :board-id="boardId"
        :prefix="board.prefix"
        :board-title="board.title"
        :read-only="readOnly"
        :card="modalState.card"
        :initial-column-id="modalState.columnId"
        :board-tags="boardTags"
        :board-columns="boardColumns"
        @close="closeModal"
        @saved="onSaved"
        @deleted="onDeleted"
      />

      <BoardSettings
        v-if="activePanel === 'columns'"
        :board-id="boardId"
        :columns="boardColumns"
        :card-counts="cardCountsByColumn()"
        @close="activePanel = null"
        @changed="onSettingsChanged"
      />

      <TagsSettings
        v-if="activePanel === 'tags'"
        :board-id="boardId"
        :tags="boardTags"
        @close="activePanel = null"
        @tag-created="onTagCreated"
        @tag-renamed="onTagRenamed"
        @tag-deleted="onTagDeleted"
      />

      <GeneralSettings
        v-if="activePanel === 'general'"
        :board-id="boardId"
        :title="board.title"
        :prefix="board.prefix"
        :density="density"
        @close="activePanel = null"
        @saved="onBoardSaved"
        @update:density="onDensityChange"
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

.status-msg {
  padding: 48px;
  text-align: center;
  color: var(--muted);
}

.key-banner {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  background: var(--success-bg);
  border: 1px solid var(--success-border);
  border-radius: 12px;
}

.key-banner-icon {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  flex: none;
  border-radius: 10px;
  background: color-mix(in srgb, var(--success-border) 22%, transparent);
  color: var(--success-border);
}
.key-banner-icon svg {
  width: 18px;
  height: 18px;
}

.key-banner-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  font-size: 13.5px;
}
.key-banner-text span {
  color: var(--muted);
}

.key-value {
  margin-top: 6px;
  max-width: 100%;
  overflow-x: auto;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 14px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 7px;
  padding: 5px 10px;
  user-select: all;
}

.key-banner-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.key-input {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

@media (max-width: 640px) {
  .key-banner {
    flex-wrap: wrap;
  }
  .key-banner-actions {
    width: 100%;
    justify-content: flex-end;
  }
}

.columns {
  display: flex;
  gap: 14px;
  padding-bottom: 8px;
  align-items: flex-start;
  overflow-x: auto;
  flex: 1;
}
</style>
