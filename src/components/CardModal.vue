<script setup lang="ts">
import { computed, ref } from "vue";
import { createCard, updateCard, deleteCard, ApiError, type Card, type Column, type Tag } from "../api";
import { renderMarkdown } from "../lib/markdown";

const props = defineProps<{
  boardId: string;
  prefix: string;
  readOnly: boolean;
  card: Card | null; // null => create mode
  initialColumnId?: number;
  boardTags: Tag[];
  boardColumns: Column[];
}>();

const emit = defineEmits<{
  close: [];
  saved: [card: Card];
  deleted: [id: number];
}>();

const isNew = props.card === null;
const title = ref(props.card?.title ?? "");
const body = ref(props.card?.body ?? "");
const columnId = ref<number>(props.card?.columnId ?? props.initialColumnId ?? props.boardColumns[0]?.id ?? 0);
const selectedTagIds = ref<number[]>(props.card?.tags?.map((t) => t.id) ?? []);
const editingBody = ref(isNew);
const saving = ref(false);
const deleting = ref(false);
const error = ref("");

const displayId = computed(() =>
  props.card ? `${props.prefix}-${props.card.seq}` : "New card"
);

const preview = computed(() => renderMarkdown(body.value));

function toggleTag(id: number) {
  if (props.readOnly) return;
  const i = selectedTagIds.value.indexOf(id);
  if (i >= 0) selectedTagIds.value.splice(i, 1);
  else selectedTagIds.value.push(id);
}

const PLACEHOLDER_TITLE = "Untitled";

async function save(opts: { usePlaceholder?: boolean } = {}) {
  if (saving.value) return;
  error.value = "";
  const trimmedTitle = title.value.trim() || (opts.usePlaceholder ? PLACEHOLDER_TITLE : "");
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
        columnId: columnId.value,
        tagIds: selectedTagIds.value,
      });
      emit("saved", created);
    } else {
      const updated = await updateCard(props.boardId, props.card!.id, {
        title: trimmedTitle,
        body: body.value,
        columnId: columnId.value,
        tagIds: selectedTagIds.value,
      });
      emit("saved", updated);
    }
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : "Failed to save card";
  } finally {
    saving.value = false;
  }
}

const backdropArmed = ref(false);

function handleBackdrop() {
  if (!backdropArmed.value) return;
  backdropArmed.value = false;
  if (props.readOnly) {
    emit("close");
    return;
  }
  save({ usePlaceholder: true });
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
  <div class="overlay" @mousedown.self="backdropArmed = true" @click.self="handleBackdrop">
    <div class="modal">
      <div class="modal-header">
        <span class="card-id">{{ displayId }}</span>
        <button class="close-btn" @click="emit('close')">&times;</button>
      </div>

      <div class="modal-body">
        <div class="col-main">
          <label>
            Title
            <input v-model="title" type="text" maxlength="255" :disabled="readOnly" />
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
        </div>

        <div class="col-side">
          <label>
            Column
            <select v-model="columnId" :disabled="readOnly">
              <option v-for="col in boardColumns" :key="col.id" :value="col.id">{{ col.name }}</option>
            </select>
          </label>

          <div class="tags-field">
            <div class="tags-label">Tags</div>
            <div v-if="boardTags.length" class="tags-chips">
              <button
                v-for="tag in boardTags"
                :key="tag.id"
                type="button"
                class="tag-chip selectable"
                :class="{ active: selectedTagIds.includes(tag.id) }"
                :disabled="readOnly"
                @click="toggleTag(tag.id)"
              >
                {{ tag.name }}
              </button>
            </div>
            <div v-else class="tags-empty">No tags yet — add them in board settings.</div>
          </div>
        </div>

        <p v-if="error" class="error">{{ error }}</p>
      </div>

      <div v-if="!readOnly" class="modal-footer">
        <button v-if="!isNew" class="btn danger" :disabled="deleting" @click="remove">
          {{ deleting ? "Deleting..." : "Delete" }}
        </button>
        <div class="spacer" />
        <button class="btn secondary" @click="emit('close')">Cancel</button>
        <button class="btn" :disabled="saving" @click="save()">
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
  max-width: 920px;
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
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 24px;
  align-items: start;
}

.col-main,
.col-side {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

@media (max-width: 720px) {
  .modal-body {
    grid-template-columns: minmax(0, 1fr);
  }
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
  min-height: 220px;
}

.body-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
}

.tags-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tags-label {
  font-weight: 600;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.tags-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tags-empty {
  font-size: 13px;
  color: var(--muted);
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
  min-height: 220px;
  font-size: 14px;
}

.markdown-preview :deep(p:first-child) {
  margin-top: 0;
}

.error {
  color: var(--danger);
  font-size: 13px;
  margin: 0;
  grid-column: 1 / -1;
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
