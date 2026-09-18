<script setup lang="ts">
import { computed, ref } from "vue";
import { createTag, deleteTag, renameTag, ApiError, type Tag } from "../api";
import ModalShell from "./ModalShell.vue";

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
// Pending rename text per tag, only present while it differs from the saved name.
const draftNames = ref<Record<number, string>>({});
const renamingId = ref<number | null>(null);
const confirmDeleteId = ref<number | null>(null);
const deletingTagId = ref<number | null>(null);
const error = ref("");

// Moves focus into the inline confirm so Escape/Enter act on it.
const vFocus = { mounted: (el: HTMLElement) => el.focus() };

const tagLimitReached = computed(() => props.tags.length >= MAX_TAGS);

function isDuplicate(name: string, exceptId?: number) {
  return props.tags.some((t) => t.id !== exceptId && t.name.toLowerCase() === name.toLowerCase());
}

async function commitRename(tag: Tag) {
  const draft = draftNames.value[tag.id];
  if (draft === undefined) return;
  const name = draft.trim();
  if (name === tag.name) {
    delete draftNames.value[tag.id];
    return;
  }
  if (!name || name.length > 50) {
    error.value = "Tag name must be 1-50 chars";
    return;
  }
  if (isDuplicate(name, tag.id)) {
    error.value = "A tag with this name already exists";
    return;
  }
  renamingId.value = tag.id;
  error.value = "";
  try {
    const updated = await renameTag(props.boardId, tag.id, name);
    emit("tagRenamed", updated);
    delete draftNames.value[tag.id];
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : "Failed to rename tag";
  } finally {
    renamingId.value = null;
  }
}

function revertRename(tag: Tag, e: KeyboardEvent) {
  delete draftNames.value[tag.id];
  error.value = "";
  (e.target as HTMLInputElement).blur();
}

async function removeTag(tag: Tag) {
  deletingTagId.value = tag.id;
  error.value = "";
  try {
    await deleteTag(props.boardId, tag.id);
    emit("tagDeleted", tag.id);
    confirmDeleteId.value = null;
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
  if (isDuplicate(name)) {
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

function onEscape(e: KeyboardEvent) {
  if (confirmDeleteId.value !== null) {
    e.preventDefault();
    confirmDeleteId.value = null;
  }
}
</script>

<template>
  <ModalShell title="Tags" subtitle="Shared by every card on this board." :width="460" @close="emit('close')">
    <section class="sheet-section" @keydown.esc="onEscape">
      <div class="sheet-section-head">
        <span class="sheet-label">Board tags</span>
        <span class="sheet-count">{{ tags.length }} / {{ MAX_TAGS }}</span>
      </div>

      <div v-if="tags.length === 0" class="sheet-empty">No tags yet — add the first one below.</div>

      <div v-else class="sheet-list">
        <div
          v-for="tag in tags"
          :key="tag.id"
          class="sheet-row"
          :class="{ 'is-confirming': confirmDeleteId === tag.id }"
        >
          <div v-if="confirmDeleteId === tag.id" class="sheet-confirm">
            <span>Delete “{{ tag.name }}”? It's removed from all cards.</span>
            <button v-focus type="button" class="go" :disabled="deletingTagId === tag.id" @click="removeTag(tag)">
              {{ deletingTagId === tag.id ? "Deleting..." : "Delete" }}
            </button>
            <button type="button" class="no" @click="confirmDeleteId = null">Cancel</button>
          </div>
          <template v-else>
            <span class="tag-glyph" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z" />
                <circle cx="8" cy="8" r="1.4" />
              </svg>
            </span>
            <input
              :value="draftNames[tag.id] ?? tag.name"
              type="text"
              maxlength="50"
              class="sheet-inline-input"
              :aria-label="`Rename tag ${tag.name}`"
              :disabled="renamingId === tag.id"
              @input="draftNames[tag.id] = ($event.target as HTMLInputElement).value"
              @blur="commitRename(tag)"
              @keydown.enter.prevent="($event.target as HTMLInputElement).blur()"
              @keydown.esc.prevent="revertRename(tag, $event)"
            />
            <button
              class="sheet-icon-btn danger"
              type="button"
              title="Delete tag"
              :aria-label="`Delete tag ${tag.name}`"
              @click="confirmDeleteId = tag.id"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
              </svg>
            </button>
          </template>
        </div>
      </div>

      <div v-if="!tagLimitReached" class="sheet-add">
        <input
          v-model="newTagName"
          type="text"
          maxlength="50"
          class="sheet-input"
          placeholder="New tag name"
          aria-label="New tag name"
          @keydown.enter.prevent="addTag"
        />
        <button class="btn secondary" type="button" :disabled="creatingTag" @click="addTag">
          {{ creatingTag ? "Adding..." : "Add" }}
        </button>
      </div>
      <p v-else class="sheet-note">Tag limit reached ({{ MAX_TAGS }}).</p>
      <p v-if="tags.length" class="sheet-note">Click a name to rename it · Enter saves, Esc reverts.</p>
    </section>

    <p v-if="error" class="sheet-error">{{ error }}</p>

    <template #footer>
      <button class="btn" type="button" @click="emit('close')">Done</button>
    </template>
  </ModalShell>
</template>

<style scoped>
.tag-glyph {
  display: grid;
  place-items: center;
  width: 22px;
  color: var(--muted);
  flex: none;
}
.tag-glyph svg {
  width: 15px;
  height: 15px;
}
</style>
