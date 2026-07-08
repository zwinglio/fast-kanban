<script setup lang="ts">
import { ref } from "vue";
import draggable from "vuedraggable";
import { createColumn, updateColumn, deleteColumn, ApiError, type Column } from "../api";
import { PALETTE } from "../lib/palette";

const MAX_COLUMNS = 8;

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
const error = ref("");
const savingId = ref<number | null>(null);

async function saveName(col: Column) {
  const name = col.name.trim();
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
  const count = props.cardCounts[col.id] ?? 0;
  if (count > 0) {
    error.value = "Cannot delete a column that still has cards";
    return;
  }
  if (localColumns.value.length <= 1) {
    error.value = "Cannot delete the last column";
    return;
  }
  if (!confirm(`Delete column "${col.name}"?`)) return;
  error.value = "";
  try {
    await deleteColumn(props.boardId, col.id);
    localColumns.value = localColumns.value.filter((c) => c.id !== col.id);
    emit("changed");
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : "Failed to delete column";
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
    emit("changed");
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : "Failed to add column";
  } finally {
    addingColumn.value = false;
  }
}

function selectSwatch(col: Column, hex: string) {
  col.color = hex;
  saveColor(col);
}
</script>

<template>
  <div class="overlay" @click.self="emit('close')">
    <div class="modal">
      <div class="modal-header">
        <span class="modal-title">Board settings</span>
        <button class="close-btn" @click="emit('close')">&times;</button>
      </div>

      <div class="modal-body">
        <div class="settings-section">
          <h3 class="section-header">Columns</h3>

          <draggable
            :list="localColumns"
            item-key="id"
            handle=".drag-handle"
            :animation="150"
            @end="onDragEnd"
          >
            <template #item="{ element }">
              <div class="column-row">
                <span class="drag-handle" title="Drag to reorder">⠿</span>
                <span class="color-dot" :style="{ background: element.color }" @click="showSwatchFor = showSwatchFor === element.id ? null : element.id" />
                <input
                  v-model="element.name"
                  type="text"
                  maxlength="50"
                  class="col-name-input"
                  :disabled="savingId === element.id"
                  @blur="saveName(element)"
                  @keyup.enter="($event.target as HTMLInputElement).blur()"
                />
                <button
                  class="icon-btn danger-btn"
                  type="button"
                  :title="(cardCounts[element.id] ?? 0) > 0 ? 'Column has cards' : localColumns.length <= 1 ? 'Last column' : 'Delete column'"
                  :disabled="(cardCounts[element.id] ?? 0) > 0 || localColumns.length <= 1"
                  @click="removeColumn(element)"
                >
                  ×
                </button>
                <div v-if="showSwatchFor === element.id" class="swatch-popover">
                  <button
                    v-for="sw in PALETTE"
                    :key="sw.hex"
                    type="button"
                    class="swatch"
                    :class="{ selected: element.color === sw.hex }"
                    :style="{ background: sw.hex }"
                    :title="sw.name"
                    @click="selectSwatch(element, sw.hex)"
                  />
                </div>
              </div>
            </template>
          </draggable>

          <div v-if="localColumns.length < MAX_COLUMNS" class="add-column-row">
            <span class="color-dot" :style="{ background: newColumnColor }" @click="showSwatchFor = showSwatchFor === -1 ? null : -1" />
            <input
              v-model="newColumnName"
              type="text"
              maxlength="50"
              placeholder="New column name"
              @keyup.enter="addColumn"
            />
            <button class="btn secondary small" type="button" :disabled="addingColumn" @click="addColumn">
              {{ addingColumn ? "Adding..." : "Add" }}
            </button>
            <div v-if="showSwatchFor === -1" class="swatch-popover">
              <button
                v-for="sw in PALETTE"
                :key="sw.hex"
                type="button"
                class="swatch"
                :class="{ selected: newColumnColor === sw.hex }"
                :style="{ background: sw.hex }"
                :title="sw.name"
                @click="newColumnColor = sw.hex"
              />
            </div>
          </div>
          <p v-else class="limit-note">Column limit reached ({{ MAX_COLUMNS }}).</p>
        </div>

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
  max-width: 520px;
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
  gap: 16px;
}

.settings-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.section-header {
  margin: 0;
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--muted);
}

.column-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border: 1px solid var(--border);
  border-radius: 6px;
  position: relative;
}

.drag-handle {
  cursor: grab;
  color: var(--muted);
  font-size: 16px;
  user-select: none;
}

.drag-handle:active {
  cursor: grabbing;
}

.color-dot {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid var(--border);
  cursor: pointer;
  flex-shrink: 0;
}

.col-name-input {
  flex: 1;
  padding: 4px 8px;
  border: 1px solid var(--border);
  border-radius: 4px;
  font-size: 14px;
}

.icon-btn {
  background: none;
  border: none;
  color: var(--muted);
  cursor: pointer;
  font-size: 18px;
  line-height: 1;
  padding: 2px 6px;
}

.icon-btn:hover:not(:disabled) {
  color: var(--danger);
}

.icon-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.swatch-popover {
  position: absolute;
  top: 100%;
  left: 32px;
  margin-top: 4px;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 8px;
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 6px;
  z-index: 10;
  box-shadow: 0 4px 12px var(--shadow-color);
}

.swatch {
  width: 22px;
  height: 22px;
  border-radius: 4px;
  border: 2px solid transparent;
  cursor: pointer;
  padding: 0;
}

.swatch.selected {
  border-color: var(--text);
  box-shadow: 0 0 0 1px var(--panel) inset;
}

.add-column-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  position: relative;
}

.add-column-row input {
  flex: 1;
  padding: 4px 8px;
  border: 1px solid var(--border);
  border-radius: 4px;
  font-size: 14px;
}

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
