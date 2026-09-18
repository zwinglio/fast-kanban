<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { updateBoard, ApiError, type Board } from "../api";
import { DENSITIES, type Density } from "../lib/density";
import ModalShell from "./ModalShell.vue";
import ToggleSwitch from "./ToggleSwitch.vue";

const props = defineProps<{
  boardId: string;
  title: string;
  prefix: string;
  density: Density;
  nextSeq: number;
  highestSeq: number; // highest card number in use, archived cards included
  pointsEnabled: boolean;
}>();

const emit = defineEmits<{
  close: [];
  saved: [board: Board];
  "update:density": [density: Density];
}>();

const title = ref(props.title);
const density = ref<Density>(props.density);
// The stored counter can lag behind if cards were created in this session.
const currentNext = Math.max(props.nextSeq, props.highestSeq + 1);
const nextSeq = ref<number | "">(currentNext);
const minNext = props.highestSeq + 1;
const MAX_SEQ = 999_999;
const nextValid = computed(
  () => Number.isInteger(nextSeq.value) && (nextSeq.value as number) >= minNext && (nextSeq.value as number) <= MAX_SEQ
);
const pointsEnabled = ref(props.pointsEnabled);
const saving = ref(false);
const error = ref("");
const titleEl = ref<HTMLInputElement | null>(null);

onMounted(() => titleEl.value?.select());

async function save() {
  const trimmed = title.value.trim();
  if (!trimmed || trimmed.length > 255) {
    error.value = "Title is required (max 255 chars)";
    return;
  }
  if (!nextValid.value) {
    error.value = `Next card number must be between ${minNext} and ${MAX_SEQ.toLocaleString()}`;
    return;
  }
  if (density.value !== props.density) emit("update:density", density.value);

  const patch: { title?: string; nextSeq?: number; pointsEnabled?: boolean } = {};
  if (pointsEnabled.value !== props.pointsEnabled) patch.pointsEnabled = pointsEnabled.value;
  if (trimmed !== props.title) patch.title = trimmed;
  if (nextSeq.value !== currentNext) patch.nextSeq = nextSeq.value as number;
  if (!Object.keys(patch).length) {
    emit("close");
    return;
  }
  saving.value = true;
  error.value = "";
  try {
    const updated = await updateBoard(props.boardId, patch);
    emit("saved", updated);
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : "Failed to save board";
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <ModalShell title="General" subtitle="Board name, identifier and layout." :width="520" @close="emit('close')">
    <section class="sheet-section">
      <div class="sheet-section-head">
        <label class="sheet-label" for="board-title">Title</label>
      </div>
      <input
        id="board-title"
        ref="titleEl"
        v-model="title"
        type="text"
        maxlength="255"
        class="sheet-input"
        placeholder="Board title"
        @keydown.enter.prevent="save"
      />
    </section>

    <section class="sheet-section">
      <div class="sheet-section-head">
        <label class="sheet-label" for="next-seq">Card numbering</label>
        <span class="sheet-key" title="Card ID prefix — can't be changed">{{ prefix }}</span>
      </div>
      <div class="seq-row" :class="{ invalid: !nextValid }">
        <span class="seq-prefix">{{ prefix }}-</span>
        <input
          id="next-seq"
          v-model.number="nextSeq"
          type="number"
          class="seq-input"
          :min="minNext"
          :max="MAX_SEQ"
          step="1"
          inputmode="numeric"
          aria-describedby="next-seq-note"
          @keydown.enter.prevent="save"
        />
        <span class="seq-caption">next card</span>
      </div>
      <p id="next-seq-note" class="sheet-note">
        <template v-if="nextValid">
          New cards continue from <b>{{ prefix }}-{{ nextSeq }}</b>.
          <template v-if="highestSeq">Must stay above {{ prefix }}-{{ highestSeq }}, the highest ID in use.</template>
          <template v-else>Set it to keep the numbering from a previous project.</template>
        </template>
        <template v-else>Use a whole number from {{ minNext }} to {{ MAX_SEQ.toLocaleString() }} so no ID is reused.</template>
      </p>
    </section>

    <section class="sheet-section">
      <div class="sheet-section-head">
        <span class="sheet-label">Estimation</span>
      </div>
      <ToggleSwitch
        v-model="pointsEnabled"
        label="Story points"
        hint="Estimate cards with points and see totals per column."
      />
      <p v-if="!pointsEnabled && props.pointsEnabled" class="sheet-note">
        Points are hidden when turned off — estimates on cards are kept.
      </p>
    </section>

    <section class="sheet-section">
      <div class="sheet-section-head">
        <span class="sheet-label">Card density</span>
      </div>
      <div class="density-grid" role="radiogroup" aria-label="Card density">
        <button
          v-for="opt in DENSITIES"
          :key="opt.value"
          type="button"
          role="radio"
          class="density-opt"
          :aria-checked="density === opt.value"
          @click="density = opt.value"
        >
          <!-- miniature card, drawn at each density -->
          <span class="mini" :class="`mini-${opt.value}`" aria-hidden="true">
            <span class="mini-card">
              <span class="mini-id" />
              <span class="mini-line" />
              <span v-if="opt.value !== 'compact'" class="mini-line short" />
              <span v-if="opt.value === 'comfortable'" class="mini-line faint" />
              <span v-if="opt.value !== 'compact'" class="mini-tags"><i /><i /></span>
            </span>
            <span class="mini-card">
              <span class="mini-id" />
              <span class="mini-line short" />
              <span v-if="opt.value === 'comfortable'" class="mini-line faint" />
            </span>
          </span>
          <span class="density-label">{{ opt.label }}</span>
          <span class="density-hint">{{ opt.hint }}</span>
        </button>
      </div>
      <p class="sheet-note">Saved in this browser, for this board.</p>
    </section>

    <p v-if="error" class="sheet-error">{{ error }}</p>

    <template #footer>
      <button class="btn secondary" type="button" @click="emit('close')">Cancel</button>
      <button class="btn" type="button" :disabled="saving" @click="save">
        {{ saving ? "Saving..." : "Save" }}
      </button>
    </template>
  </ModalShell>
</template>

<style scoped>
.seq-row {
  display: flex;
  align-items: center;
  max-width: 300px;
  min-height: 36px;
  background: var(--sunken);
  border: 1px solid var(--border);
  border-radius: 8px;
  transition: border-color 0.15s ease;
}
.seq-row:focus-within {
  border-color: var(--accent);
}
.seq-row.invalid {
  border-color: var(--danger);
}
.seq-prefix {
  padding-left: 10px;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.06em;
  color: var(--muted);
  white-space: nowrap;
}
.seq-input {
  flex: 1;
  min-width: 0;
  padding: 6px 4px 6px 2px;
  border: 0;
  background: transparent;
  color: var(--text);
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.04em;
}
.seq-input:focus {
  outline: none;
}
.seq-caption {
  padding-right: 10px;
  font-size: 12px;
  color: var(--muted);
  white-space: nowrap;
}

.density-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.density-opt {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: 8px 8px 10px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  color: var(--text);
  text-align: left;
  transition: border-color 0.15s ease, background 0.15s ease;
}
.density-opt:hover {
  border-color: color-mix(in srgb, var(--border) 50%, var(--text));
}
.density-opt[aria-checked="true"] {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.density-label {
  margin-top: 6px;
  font-size: 13px;
  font-weight: 600;
}
.density-opt[aria-checked="true"] .density-label {
  color: var(--accent);
}
.density-hint {
  font-size: 11.5px;
  line-height: 1.35;
  color: var(--muted);
}

/* miniature preview */
.mini {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 74px;
  padding: 6px;
  overflow: hidden;
  background: var(--sunken);
  border-radius: 7px;
}
.mini-compact { gap: 3px; }
.mini-default { gap: 4px; }
.mini-comfortable { gap: 5px; }

.mini-card {
  display: flex;
  flex-direction: column;
  gap: 3px;
  flex: none;
  padding: 4px 5px;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 4px;
}
.mini-comfortable .mini-card { padding: 6px; gap: 4px; }

.mini-id,
.mini-line,
.mini-tags i {
  display: block;
  height: 3px;
  border-radius: 2px;
}
.mini-id {
  width: 26%;
  background: var(--accent);
  opacity: 0.8;
}
.mini-line {
  width: 88%;
  background: var(--text);
  opacity: 0.35;
}
.mini-line.short { width: 60%; }
.mini-line.faint { width: 76%; opacity: 0.16; }
.mini-tags {
  display: flex;
  gap: 3px;
  margin-top: 1px;
}
.mini-tags i {
  width: 16px;
  height: 5px;
  border-radius: 999px;
  background: var(--muted);
  opacity: 0.35;
}

@media (max-width: 520px) {
  .density-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
