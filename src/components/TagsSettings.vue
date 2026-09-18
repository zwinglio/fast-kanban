<script setup lang="ts">
import { computed, ref } from "vue";
import { createTag, deleteTag, renameTag, ApiError, type Tag } from "../api";

const MAX_TAGS = 5;

const props = defineProps<{
  boardId: string;
  tags: Tag[];
}>();

const emit = defineEmits<{
  close: [];
  tagCreated: [tag: Tag];
  tagRenamed: [tag: Tag];
  tagDeleted: [id: number];
}>();

const newTagName = ref("");
const creatingTag = ref(false);
const editingTagId = ref<number | null>(null);
const editTagName = ref("");
const renamingTag = ref(false);
const deletingTagId = ref<number | null>(null);
const error = ref("");

const tagLimitReached = computed(() => props.tags.length >= MAX_TAGS);

function startRenameTag(tag: Tag) {
  editingTagId.value = tag.id;
  editTagName.value = tag.name;
}

function cancelRenameTag() {
  editingTagId.value = null;
  editTagName.value = "";
}

async function confirmRenameTag(tag: Tag) {
  const name = editTagName.value.trim();
  if (!name || name.length > 50) {
    error.value = "Tag name must be 1-50 chars";
    return;
  }
  if (name === tag.name) {
    cancelRenameTag();
    return;
  }
  renamingTag.value = true;
  error.value = "";
  try {
    const updated = await renameTag(props.boardId, tag.id, name);
    emit("tagRenamed", updated);
    cancelRenameTag();
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : "Failed to rename tag";
  } finally {
    renamingTag.value = false;
  }
}

async function removeTag(tag: Tag) {
  if (!confirm(`Delete tag "${tag.name}"? This removes it from all cards.`)) return;
  deletingTagId.value = tag.id;
  error.value = "";
  try {
    await deleteTag(props.boardId, tag.id);
    emit("tagDeleted", tag.id);
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : "Failed to delete tag";
  } finally {
    deletingTagId.value = null;
  }
}

async function addTag() {
  error.value = "";
  const name = newTagName.value.trim();
  if (!name || name.length > 50) {
    error.value = "Tag name must be 1-50 chars";
    return;
  }
  if (props.tags.some((t) => t.name.toLowerCase() === name.toLowerCase())) {
    error.value = "A tag with this name already exists";
    return;
  }
  creatingTag.value = true;
  try {
    const tag = await createTag(props.boardId, name);
    emit("tagCreated", tag);
    newTagName.value = "";
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : "Failed to create tag";
  } finally {
    creatingTag.value = false;
  }
}
</script>

<template>
  <div class="overlay" @click.self="emit('close')">
    <div class="modal">
      <div class="modal-header">
        <span class="modal-title">Tags</span>
        <button class="close-btn" @click="emit('close')">&times;</button>
      </div>

      <div class="modal-body">
        <p v-if="tags.length === 0" class="empty-note">No tags yet.</p>

        <div v-for="tag in tags" :key="tag.id" class="tag-row">
          <template v-if="editingTagId === tag.id">
            <input
              v-model="editTagName"
              type="text"
              maxlength="50"
              class="tag-input"
              :disabled="renamingTag"
              @keyup.enter="confirmRenameTag(tag)"
              @keyup.esc="cancelRenameTag"
            />
            <button class="icon-btn" type="button" :disabled="renamingTag" @click="confirmRenameTag(tag)">✓</button>
            <button class="icon-btn" type="button" @click="cancelRenameTag">✕</button>
          </template>
          <template v-else>
            <span class="tag-chip">{{ tag.name }}</span>
            <div class="tag-actions">
              <button
                class="icon-btn"
                type="button"
                title="Rename tag"
                @click="startRenameTag(tag)"
              >✎</button>
              <button
                class="icon-btn danger-btn"
                type="button"
                title="Delete tag"
                :disabled="deletingTagId === tag.id"
                @click="removeTag(tag)"
              >×</button>
            </div>
          </template>
        </div>

        <div v-if="!tagLimitReached" class="add-tag-row">
          <input
            v-model="newTagName"
            type="text"
            maxlength="50"
            class="tag-input"
            placeholder="New tag name"
            @keyup.enter="addTag"
          />
          <button class="btn secondary small" type="button" :disabled="creatingTag" @click="addTag">
            {{ creatingTag ? "Adding..." : "Add" }}
          </button>
        </div>
        <p v-else class="limit-note">Tag limit reached ({{ MAX_TAGS }}).</p>

        <p v-if="error" class="error">{{ error }}</p>
      </div>

      <div class="modal-footer">
        <div class="spacer" />
        <button class="btn" @click="emit('close')">Done</button>
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
  max-width: 440px;
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

.modal-title {
  font-weight: 700;
  font-size: 16px;
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
  gap: 10px;
}

.tag-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border: 1px solid var(--border);
  border-radius: 6px;
}

.tag-chip {
  flex: 1;
  background: var(--badge-bg);
  border-radius: 12px;
  padding: 2px 10px;
  font-size: 13px;
  font-weight: 600;
  color: var(--muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tag-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.tag-input {
  flex: 1;
  padding: 4px 8px;
  border: 1px solid var(--border);
  border-radius: 4px;
  font-size: 14px;
}

.add-tag-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
}

.icon-btn {
  background: none;
  border: none;
  color: var(--muted);
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  padding: 2px 6px;
}

.icon-btn:hover:not(:disabled) {
  color: var(--accent);
}

.danger-btn:hover:not(:disabled) {
  color: var(--danger);
}

.icon-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.empty-note,
.limit-note {
  margin: 0;
  font-size: 12px;
  color: var(--muted);
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

.btn.small {
  padding: 4px 10px;
  font-size: 12px;
}
</style>
