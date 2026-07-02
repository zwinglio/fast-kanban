<script setup lang="ts">
import { computed, ref } from "vue";
import { createCard, updateCard, deleteCard, ApiError, type Card, type CardStatus } from "../api";
import { renderMarkdown } from "../lib/markdown";

const props = defineProps<{
  boardId: string;
  prefix: string;
  readOnly: boolean;
  card: Card | null; // null => create mode
  initialStatus?: CardStatus;
}>();

const emit = defineEmits<{
  close: [];
  saved: [card: Card];
  deleted: [id: number];
}>();

const isNew = props.card === null;
const title = ref(props.card?.title ?? "");
const body = ref(props.card?.body ?? "");
const status = ref<CardStatus>(props.card?.status ?? props.initialStatus ?? "backlog");
const editingBody = ref(isNew);
const saving = ref(false);
const deleting = ref(false);
const error = ref("");

const displayId = computed(() =>
  props.card ? `${props.prefix}-${props.card.seq}` : "New card"
);

const preview = computed(() => renderMarkdown(body.value));

async function save() {
  error.value = "";
  const trimmedTitle = title.value.trim();
  if (!trimmedTitle) {
    error.value = "Title is required";
    return;
  }
  saving.value = true;
  try {
    if (isNew) {
      const created = await createCard(props.boardId, {
        title: trimmedTitle,
        body: body.value,
        status: status.value,
      });
      emit("saved", created);
    } else {
      const updated = await updateCard(props.boardId, props.card!.id, {
        title: trimmedTitle,
        body: body.value,
        status: status.value,
      });
      emit("saved", updated);
    }
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : "Failed to save card";
  } finally {
    saving.value = false;
  }
}

async function remove() {
  if (!props.card) return;
  if (!confirm("Delete this card? This cannot be undone.")) return;
  deleting.value = true;
  error.value = "";
  try {
    await deleteCard(props.boardId, props.card.id);
    emit("deleted", props.card.id);
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : "Failed to delete card";
  } finally {
    deleting.value = false;
  }
}
</script>

<template>
  <div class="overlay" @click.self="emit('close')">
    <div class="modal">
      <div class="modal-header">
        <span class="card-id">{{ displayId }}</span>
        <button class="close-btn" @click="emit('close')">&times;</button>
      </div>

      <div class="modal-body">
        <label>
          Title
          <input v-model="title" type="text" maxlength="255" :disabled="readOnly" />
        </label>

        <label>
          Status
          <select v-model="status" :disabled="readOnly">
            <option value="backlog">Backlog</option>
            <option value="todo">Todo</option>
            <option value="doing">Doing</option>
            <option value="done">Done</option>
          </select>
        </label>

        <div class="body-field">
          <div class="body-header">
            <span>Description (Markdown)</span>
            <button
              v-if="!readOnly"
              class="btn secondary small"
              type="button"
              @click="editingBody = !editingBody"
            >
              {{ editingBody ? "Preview" : "Edit" }}
            </button>
          </div>
          <textarea
            v-if="editingBody && !readOnly"
            v-model="body"
            rows="10"
            placeholder="Write markdown here..."
          />
          <div v-else class="markdown-preview" v-html="preview || '<p><em>No description</em></p>'" />
        </div>

        <p v-if="error" class="error">{{ error }}</p>
      </div>

      <div v-if="!readOnly" class="modal-footer">
        <button v-if="!isNew" class="btn danger" :disabled="deleting" @click="remove">
          {{ deleting ? "Deleting..." : "Delete" }}
        </button>
        <div class="spacer" />
        <button class="btn secondary" @click="emit('close')">Cancel</button>
        <button class="btn" :disabled="saving" @click="save">
          {{ saving ? "Saving..." : "Save" }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: var(--overlay-bg);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 48px 16px;
  z-index: 100;
}

.modal {
  background: var(--panel);
  border-radius: 8px;
  width: 100%;
  max-width: 560px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
}

.card-id {
  font-weight: 700;
  color: var(--accent);
}

.close-btn {
  background: none;
  border: none;
  font-size: 22px;
  line-height: 1;
  color: var(--muted);
}

.modal-body {
  padding: 20px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-weight: 600;
  font-size: 13px;
}

input,
select,
textarea {
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 4px;
  font-weight: normal;
  font-family: inherit;
}

textarea {
  resize: vertical;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 13px;
}

.body-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.body-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
  font-size: 13px;
}

.btn.small {
  padding: 4px 10px;
  font-size: 12px;
}

.markdown-preview {
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 10px 12px;
  min-height: 100px;
  font-size: 14px;
}

.markdown-preview :deep(p:first-child) {
  margin-top: 0;
}

.error {
  color: var(--danger);
  font-size: 13px;
  margin: 0;
}

.modal-footer {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px 20px;
  border-top: 1px solid var(--border);
}

.spacer {
  flex: 1;
}
</style>
