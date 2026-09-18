<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import draggable from "vuedraggable";
import { createColumn, updateColumn, deleteColumn, ApiError, type Column } from "../api";
import { PALETTE } from "../lib/palette";
import ModalShell from "./ModalShell.vue";

const MAX_COLUMNS = 8;
const NEW_COLUMN = -1; // swatch popover id for the "add column" row

const props = defineProps<{
  boardId: string;
  columns: Column[];
  cardCounts: Record<number, number>;
}>();

const emit = defineEmits<{
  close: [];
  changed: [];
}>();

const localColumns = ref<Column[]>([...props.columns]);
const showSwatchFor = ref<number | null>(null);
const newColumnName = ref("");
const newColumnColor = ref(PALETTE[0].hex);
const addingColumn = ref(false);
const confirmDeleteId = ref<number | null>(null);
const deletingId = ref<number | null>(null);
const error = ref("");
const savingId = ref<number | null>(null);
// Name as it was when the input gained focus, so Escape can restore it.
let nameBeforeEdit = "";

// Moves focus into the inline confirm so Escape/Enter act on it.
const vFocus = { mounted: (el: HTMLElement) => el.focus() };

function cardCount(col: Column) {
  return props.cardCounts[col.id] ?? 0;
}

function deleteBlockedReason(col: Column) {
  if (cardCount(col) > 0) return "Move or delete its cards first";
  if (localColumns.value.length <= 1) return "A board needs at least one column";
  return "";
}

async function saveName(col: Column) {
  const name = col.name.trim();
  if (name === nameBeforeEdit) {
    col.name = name;
    return;
  }
  if (!name || name.length > 50) {
    error.value = "Column name must be 1-50 chars";
    return;
  }
  error.value = "";
  savingId.value = col.id;
  try {
    const updated = await updateColumn(props.boardId, col.id, { name });
    Object.assign(col, updated);
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : "Failed to rename column";
  } finally {
    savingId.value = null;
  }
}

function revertName(col: Column, e: KeyboardEvent) {
  col.name = nameBeforeEdit;
  error.value = "";
  (e.target as HTMLInputElement).blur();
}

async function saveColor(col: Column) {
  error.value = "";
  savingId.value = col.id;
  try {
    const updated = await updateColumn(props.boardId, col.id, { color: col.color });
    Object.assign(col, updated);
    showSwatchFor.value = null;
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : "Failed to update color";
  } finally {
    savingId.value = null;
  }
}

async function onDragEnd() {
  error.value = "";
  for (let i = 0; i < localColumns.value.length; i++) {
    const col = localColumns.value[i];
    if (col.position !== i) {
      col.position = i;
      try {
        await updateColumn(props.boardId, col.id, { position: i });
      } catch (e) {
        error.value = e instanceof ApiError ? e.message : "Failed to reorder columns";
      }
    }
  }
  emit("changed");
}

async function removeColumn(col: Column) {
  const blocked = deleteBlockedReason(col);
  if (blocked) {
    error.value = blocked;
    confirmDeleteId.value = null;
    return;
  }
  error.value = "";
  deletingId.value = col.id;
  try {
    await deleteColumn(props.boardId, col.id);
    localColumns.value = localColumns.value.filter((c) => c.id !== col.id);
    confirmDeleteId.value = null;
    emit("changed");
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : "Failed to delete column";
  } finally {
    deletingId.value = null;
  }
}

async function addColumn() {
  const name = newColumnName.value.trim();
  if (!name || name.length > 50) {
    error.value = "Column name must be 1-50 chars";
    return;
  }
  if (localColumns.value.length >= MAX_COLUMNS) {
    error.value = `Maximum ${MAX_COLUMNS} columns`;
    return;
  }
  error.value = "";
  addingColumn.value = true;
  try {
    const created = await createColumn(props.boardId, name, newColumnColor.value);
    localColumns.value = [...localColumns.value, created];
    newColumnName.value = "";
    showSwatchFor.value = null;
    emit("changed");
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : "Failed to add column";
  } finally {
    addingColumn.value = false;
  }
}

function toggleSwatches(id: number) {
  showSwatchFor.value = showSwatchFor.value === id ? null : id;
}

function selectSwatch(col: Column, hex: string) {
  col.color = hex;
  saveColor(col);
}

function selectNewSwatch(hex: string) {
  newColumnColor.value = hex;
  showSwatchFor.value = null;
}

function onEscape(e: KeyboardEvent) {
  if (showSwatchFor.value !== null) {
    e.preventDefault();
    showSwatchFor.value = null;
  } else if (confirmDeleteId.value !== null) {
    e.preventDefault();
    confirmDeleteId.value = null;
  }
}

function onDocMousedown(e: MouseEvent) {
  if (showSwatchFor.value === null) return;
  const target = e.target as HTMLElement;
  if (!target.closest(".sheet-swatches, .sheet-swatch-btn")) showSwatchFor.value = null;
}

onMounted(() => document.addEventListener("mousedown", onDocMousedown));
onBeforeUnmount(() => document.removeEventListener("mousedown", onDocMousedown));
</script>

<template>
  <ModalShell
    title="Columns & statuses"
    subtitle="Rename, recolor and drag to reorder the board's columns."
    :width="520"
    @close="emit('close')"
  >
    <section class="sheet-section" @keydown.esc="onEscape">
      <div class="sheet-section-head">
        <span class="sheet-label">Columns</span>
        <span class="sheet-count">{{ localColumns.length }} / {{ MAX_COLUMNS }}</span>
      </div>

      <draggable
        :list="localColumns"
        item-key="id"
        handle=".sheet-grip"
        class="sheet-list"
        :animation="150"
        @end="onDragEnd"
      >
        <template #item="{ element }">
          <div class="sheet-row" :class="{ 'is-confirming': confirmDeleteId === element.id }">
            <div v-if="confirmDeleteId === element.id" class="sheet-confirm">
              <span>Delete column “{{ element.name }}”?</span>
              <button
                v-focus
                type="button"
                class="go"
                :disabled="deletingId === element.id"
                @click="removeColumn(element)"
              >
                {{ deletingId === element.id ? "Deleting..." : "Delete" }}
              </button>
              <button type="button" class="no" @click="confirmDeleteId = null">Cancel</button>
            </div>
            <template v-else>
              <span class="sheet-grip" title="Drag to reorder" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="9" cy="6" r="1.6" /><circle cx="15" cy="6" r="1.6" />
                  <circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="12" r="1.6" />
                  <circle cx="9" cy="18" r="1.6" /><circle cx="15" cy="18" r="1.6" />
                </svg>
              </span>
              <button
                type="button"
                class="sheet-swatch-btn"
                :style="{ background: element.color }"
                :title="'Change color'"
                :aria-label="`Change color of ${element.name}`"
                :aria-expanded="showSwatchFor === element.id"
                @click="toggleSwatches(element.id)"
              />
              <input
                v-model="element.name"
                type="text"
                maxlength="50"
                class="sheet-inline-input"
                :aria-label="`Rename column ${element.name}`"
                :disabled="savingId === element.id"
                @focus="nameBeforeEdit = element.name"
                @blur="saveName(element)"
                @keydown.enter.prevent="($event.target as HTMLInputElement).blur()"
                @keydown.esc.prevent="revertName(element, $event)"
              />
              <span class="sheet-meta">
                {{ cardCount(element) }} {{ cardCount(element) === 1 ? "card" : "cards" }}
              </span>
              <button
                class="sheet-icon-btn danger"
                type="button"
                :title="deleteBlockedReason(element) || 'Delete column'"
                :aria-label="`Delete column ${element.name}`"
                :disabled="!!deleteBlockedReason(element)"
                @click="confirmDeleteId = element.id"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
                </svg>
              </button>
              <div v-if="showSwatchFor === element.id" class="sheet-swatches swatches-in-row">
                <button
                  v-for="sw in PALETTE"
                  :key="sw.hex"
                  type="button"
                  class="sheet-swatch"
                  :class="{ selected: element.color === sw.hex }"
                  :style="{ background: sw.hex }"
                  :title="sw.name"
                  :aria-label="sw.name"
                  @click="selectSwatch(element, sw.hex)"
                />
              </div>
            </template>
          </div>
        </template>
      </draggable>

      <div v-if="localColumns.length < MAX_COLUMNS" class="sheet-add">
        <button
          type="button"
          class="sheet-swatch-btn"
          :style="{ background: newColumnColor }"
          title="Pick a color"
          aria-label="Pick a color for the new column"
          :aria-expanded="showSwatchFor === NEW_COLUMN"
          @click="toggleSwatches(NEW_COLUMN)"
        />
        <input
          v-model="newColumnName"
          type="text"
          maxlength="50"
          class="sheet-input"
          placeholder="New column name"
          aria-label="New column name"
          @keydown.enter.prevent="addColumn"
        />
        <button class="btn secondary" type="button" :disabled="addingColumn" @click="addColumn">
          {{ addingColumn ? "Adding..." : "Add" }}
        </button>
        <div v-if="showSwatchFor === NEW_COLUMN" class="sheet-swatches">
          <button
            v-for="sw in PALETTE"
            :key="sw.hex"
            type="button"
            class="sheet-swatch"
            :class="{ selected: newColumnColor === sw.hex }"
            :style="{ background: sw.hex }"
            :title="sw.name"
            :aria-label="sw.name"
            @click="selectNewSwatch(sw.hex)"
          />
        </div>
      </div>
      <p v-else class="sheet-note">Column limit reached ({{ MAX_COLUMNS }}).</p>
    </section>

    <p v-if="error" class="sheet-error">{{ error }}</p>

    <template #footer>
      <button class="btn" type="button" @click="emit('close')">Done</button>
    </template>
  </ModalShell>
</template>

<style scoped>
/* line the popover up under the color dot, past the drag handle */
.swatches-in-row {
  left: 30px;
}
</style>
