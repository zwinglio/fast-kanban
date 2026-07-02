<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { useRoute } from "vue-router";
import { getBoard, updateCard, verifyEditKey as apiVerifyEditKey, type Board, type Card, type CardStatus } from "../api";
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

      <div class="columns">
        <Column
          v-for="s in STATUSES"
          :key="s.key"
          :title="s.label"
          :status="s.key"
          :cards="columns[s.key]"
          :prefix="board.prefix"
          :read-only="readOnly"
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
        @close="closeModal"
        @saved="onSaved"
        @deleted="onDeleted"
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
