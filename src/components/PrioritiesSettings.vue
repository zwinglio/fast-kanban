<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import draggable from "vuedraggable";
import { createPriority, updatePriority, deletePriority, ApiError, type Priority } from "../api";
import { PALETTE } from "../lib/palette";
import ModalShell from "./ModalShell.vue";
import PriorityIcon from "./PriorityIcon.vue";

const MAX_PRIORITIES = 6;
const NEW_PRIORITY = -1; // swatch popover id for the "add priority" row

const props = defineProps<{
  boardId: string;
  priorities: Priority[];
  cardCounts: Record<number, number>; // cards per priority id
}>();

const emit = defineEmits<{
  close: [];
  changed: [];
}>();

const localPriorities = ref<Priority[]>([...props.priorities]);
const showSwatchFor = ref<number | null>(null);
const newName = ref("");
const newColor = ref(PALETTE[4].hex);
const adding = ref(false);
const confirmDeleteId = ref<number | null>(null);
const deletingId = ref<number | null>(null);
const error = ref("");
const savingId = ref<number | null>(null);
// Name as it was when the input gained focus, so Escape can restore it.
let nameBeforeEdit = "";

// Moves focus into the inline confirm so Escape/Enter act on it.
const vFocus = { mounted: (el: HTMLElement) => el.focus() };

function cardCount(p: Priority) {
  return props.cardCounts[p.id] ?? 0;
}

async function saveName(p: Priority) {
  const name = p.name.trim();
  if (name === nameBeforeEdit) {
    p.name = name;
    return;
  }
  if (!name || name.length > 30) {
    error.value = "Priority name must be 1-30 chars";
    return;
  }
  error.value = "";
  savingId.value = p.id;
  try {
    const updated = await updatePriority(props.boardId, p.id, { name });
    Object.assign(p, updated);
    emit("changed");
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : "Failed to rename priority";
  } finally {
    savingId.value = null;
  }
}

function revertName(p: Priority, e: KeyboardEvent) {
  p.name = nameBeforeEdit;
  error.value = "";
  (e.target as HTMLInputElement).blur();
}

async function saveColor(p: Priority) {
  error.value = "";
  savingId.value = p.id;
  try {
    const updated = await updatePriority(props.boardId, p.id, { color: p.color });
    Object.assign(p, updated);
    showSwatchFor.value = null;
    emit("changed");
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : "Failed to update color";
  } finally {
    savingId.value = null;
  }
}

async function onDragEnd() {
  error.value = "";
  for (let i = 0; i < localPriorities.value.length; i++) {
    const p = localPriorities.value[i];
    if (p.position !== i) {
      p.position = i;
      try {
        await updatePriority(props.boardId, p.id, { position: i });
      } catch (e) {
        error.value = e instanceof ApiError ? e.message : "Failed to reorder priorities";
      }
    }
  }
  emit("changed");
}

async function removePriority(p: Priority) {
  error.value = "";
  deletingId.value = p.id;
  try {
    await deletePriority(props.boardId, p.id);
    localPriorities.value = localPriorities.value.filter((x) => x.id !== p.id);
    confirmDeleteId.value = null;
    emit("changed");
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : "Failed to delete priority";
  } finally {
    deletingId.value = null;
  }
}

async function addPriority() {
  const name = newName.value.trim();
  if (!name || name.length > 30) {
    error.value = "Priority name must be 1-30 chars";
    return;
  }
  if (localPriorities.value.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
    error.value = "A priority with this name already exists";
    return;
  }
  if (localPriorities.value.length >= MAX_PRIORITIES) {
    error.value = `Maximum ${MAX_PRIORITIES} priorities`;
    return;
  }
  error.value = "";
  adding.value = true;
  try {
    const created = await createPriority(props.boardId, name, newColor.value);
    localPriorities.value = [...localPriorities.value, created];
    newName.value = "";
    showSwatchFor.value = null;
    emit("changed");
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : "Failed to add priority";
  } finally {
    adding.value = false;
  }
}

function toggleSwatches(id: number) {
  showSwatchFor.value = showSwatchFor.value === id ? null : id;
}

function selectSwatch(p: Priority, hex: string) {
  p.color = hex;
  saveColor(p);
}

function selectNewSwatch(hex: string) {
  newColor.value = hex;
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
  if (!target.closest(".sheet-swatches, .flag-btn")) showSwatchFor.value = null;
}

onMounted(() => document.addEventListener("mousedown", onDocMousedown));
onBeforeUnmount(() => document.removeEventListener("mousedown", onDocMousedown));
</script>

<template>
  <ModalShell
    title="Priorities"
    subtitle="Drag to rank them — the top one is the most urgent."
    :width="520"
    @close="emit('close')"
  >
    <section class="sheet-section" @keydown.esc="onEscape">
      <div class="sheet-section-head">
        <span class="sheet-label">Board priorities</span>
        <span class="sheet-count">{{ localPriorities.length }} / {{ MAX_PRIORITIES }}</span>
      </div>

      <div v-if="localPriorities.length === 0" class="sheet-empty">No priorities — add the first one below.</div>

      <draggable
        :list="localPriorities"
        item-key="id"
        handle=".sheet-grip"
        class="sheet-list"
        :animation="150"
        @end="onDragEnd"
      >
        <template #item="{ element, index }">
          <div class="sheet-row" :class="{ 'is-confirming': confirmDeleteId === element.id }">
            <div v-if="confirmDeleteId === element.id" class="sheet-confirm">
              <span>
                Delete “{{ element.name }}”?
                <template v-if="cardCount(element)">{{ cardCount(element) }} {{ cardCount(element) === 1 ? "card loses" : "cards lose" }} it.</template>
              </span>
              <button
                v-focus
                type="button"
                class="go"
                :disabled="deletingId === element.id"
                @click="removePriority(element)"
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
              <span class="rank" :title="index === 0 ? 'Most urgent' : `Rank ${index + 1}`">{{ index + 1 }}</span>
              <button
                type="button"
                class="flag-btn"
                :title="'Change color'"
                :aria-label="`Change color of ${element.name}`"
                :aria-expanded="showSwatchFor === element.id"
                @click="toggleSwatches(element.id)"
              >
                <PriorityIcon :color="element.color" :size="16" />
              </button>
              <input
                v-model="element.name"
                type="text"
                maxlength="30"
                class="sheet-inline-input"
                :aria-label="`Rename priority ${element.name}`"
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
                title="Delete priority"
                :aria-label="`Delete priority ${element.name}`"
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

      <div v-if="localPriorities.length < MAX_PRIORITIES" class="sheet-add">
        <button
          type="button"
          class="flag-btn"
          title="Pick a color"
          aria-label="Pick a color for the new priority"
          :aria-expanded="showSwatchFor === NEW_PRIORITY"
          @click="toggleSwatches(NEW_PRIORITY)"
        >
          <PriorityIcon :color="newColor" :size="16" />
        </button>
        <input
          v-model="newName"
          type="text"
          maxlength="30"
          class="sheet-input"
          placeholder="New priority name"
          aria-label="New priority name"
          @keydown.enter.prevent="addPriority"
        />
        <button class="btn secondary" type="button" :disabled="adding" @click="addPriority">
          {{ adding ? "Adding..." : "Add" }}
        </button>
        <div v-if="showSwatchFor === NEW_PRIORITY" class="sheet-swatches">
          <button
            v-for="sw in PALETTE"
            :key="sw.hex"
            type="button"
            class="sheet-swatch"
            :class="{ selected: newColor === sw.hex }"
            :style="{ background: sw.hex }"
            :title="sw.name"
            :aria-label="sw.name"
            @click="selectNewSwatch(sw.hex)"
          />
        </div>
      </div>
      <p v-else class="sheet-note">Priority limit reached ({{ MAX_PRIORITIES }}).</p>
      <p class="sheet-note">Cards can also have no priority. Deleting one clears it from its cards.</p>
    </section>

    <p v-if="error" class="sheet-error">{{ error }}</p>

    <template #footer>
      <button class="btn" type="button" @click="emit('close')">Done</button>
    </template>
  </ModalShell>
</template>

<style scoped>
.rank {
  width: 16px;
  flex: none;
  text-align: center;
  font-size: 12px;
  font-weight: 600;
  color: var(--muted);
}

.flag-btn {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  flex: none;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: 7px;
  background: var(--panel);
  cursor: pointer;
}
.flag-btn:hover,
.flag-btn[aria-expanded="true"] {
  border-color: var(--muted);
}

/* line the popover up under the flag, past the handle and rank */
.swatches-in-row {
  left: 50px;
}
</style>
