<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { deleteBoard, updateBoard, ApiError, apiErrorMessage, type Board } from "../api";
import { DENSITIES, type Density } from "../lib/density";
import ModalShell from "./ModalShell.vue";
import ToggleSwitch from "./ToggleSwitch.vue";
import BoardIcon from "./BoardIcon.vue";
import { BOARD_ICONS } from "../lib/boardIcons";

const { t, n } = useI18n();

const props = defineProps<{
  boardId: string;
  title: string;
  prefix: string;
  icon: string | null;
  density: Density;
  nextSeq: number;
  highestSeq: number; // highest card number in use, archived cards included
  pointsEnabled: boolean;
  dependenciesEnabled: boolean;
}>();

const emit = defineEmits<{
  close: [];
  saved: [board: Board];
  deleted: [];
  "update:density": [density: Density];
}>();

const title = ref(props.title);
const icon = ref<string | null>(props.icon);
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
const dependenciesEnabled = ref(props.dependenciesEnabled);
const saving = ref(false);
const error = ref("");
const titleEl = ref<HTMLInputElement | null>(null);

// Deleting requires typing the saved title (not the possibly-edited one above).
const confirmingDelete = ref(false);
const deleteConfirm = ref("");
const deleting = ref(false);
const canDelete = computed(() => deleteConfirm.value.trim() === props.title);

onMounted(() => titleEl.value?.select());

/** Localised message for a failed API call, with a translated fallback. */
function errorText(e: unknown, fallbackKey: string): string {
  return e instanceof ApiError ? apiErrorMessage(e) : t(fallbackKey);
}

function cancelDelete() {
  confirmingDelete.value = false;
  deleteConfirm.value = "";
  error.value = "";
}

async function removeBoard() {
  if (!canDelete.value || deleting.value) return;
  deleting.value = true;
  error.value = "";
  try {
    await deleteBoard(props.boardId, deleteConfirm.value.trim());
    emit("deleted");
  } catch (e) {
    error.value = errorText(e, "settings.general.deleteFailed");
  } finally {
    deleting.value = false;
  }
}

async function save() {
  const trimmed = title.value.trim();
  if (!trimmed || trimmed.length > 255) {
    error.value = t("settings.general.titleRequired");
    return;
  }
  if (!nextValid.value) {
    error.value = t("settings.general.seqRange", {
      min: n(minNext, "integer"),
      max: n(MAX_SEQ, "integer"),
    });
    return;
  }
  if (density.value !== props.density) emit("update:density", density.value);

  const patch: {
    title?: string;
    icon?: string | null;
    nextSeq?: number;
    pointsEnabled?: boolean;
    dependenciesEnabled?: boolean;
  } = {};
  if (icon.value !== props.icon) patch.icon = icon.value;
  if (pointsEnabled.value !== props.pointsEnabled) patch.pointsEnabled = pointsEnabled.value;
  if (dependenciesEnabled.value !== props.dependenciesEnabled) patch.dependenciesEnabled = dependenciesEnabled.value;
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
    error.value = errorText(e, "settings.general.saveFailed");
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <ModalShell
    :title="t('settings.general.title')"
    :subtitle="t('settings.general.subtitle')"
    :width="520"
    @close="emit('close')"
  >
    <section class="sheet-section">
      <div class="sheet-section-head">
        <label class="sheet-label" for="board-title">{{ t("settings.general.titleLabel") }}</label>
      </div>
      <div class="title-row">
        <BoardIcon :icon="icon" :title="title" :size="36" />
        <input
          id="board-title"
          ref="titleEl"
          v-model="title"
          type="text"
          maxlength="255"
          class="sheet-input"
          :placeholder="t('settings.general.titlePlaceholder')"
          @keydown.enter.prevent="save"
        />
      </div>
    </section>

    <section class="sheet-section">
      <div class="sheet-section-head">
        <span class="sheet-label">{{ t("settings.general.iconLabel") }}</span>
      </div>
      <div class="icon-grid" role="radiogroup" :aria-label="t('settings.general.iconGroupAria')">
        <button
          type="button"
          role="radio"
          class="icon-opt"
          :aria-checked="icon === null"
          :title="t('settings.general.firstLetter')"
          @click="icon = null"
        >
          <BoardIcon :title="title" :size="30" :muted="icon !== null" />
        </button>
        <button
          v-for="opt in BOARD_ICONS"
          :key="opt.id"
          type="button"
          role="radio"
          class="icon-opt"
          :aria-checked="icon === opt.id"
          :title="t(opt.labelKey)"
          :aria-label="t(opt.labelKey)"
          @click="icon = opt.id"
        >
          <BoardIcon :icon="opt.id" :size="30" :muted="icon !== opt.id" />
        </button>
      </div>
      <p class="sheet-note">{{ t("settings.general.iconNote") }}</p>
    </section>

    <section class="sheet-section">
      <div class="sheet-section-head">
        <label class="sheet-label" for="next-seq">{{ t("settings.general.cardNumbering") }}</label>
        <span class="sheet-key" :title="t('settings.general.prefixTitle')">{{ prefix }}</span>
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
        <span class="seq-caption">{{ t("settings.general.nextCard") }}</span>
      </div>
      <p id="next-seq-note" class="sheet-note">
        <i18n-t v-if="nextValid && highestSeq" keypath="settings.general.seqContinueAbove" tag="span">
          <template #id><b>{{ prefix }}-{{ nextSeq }}</b></template>
          <template #above>{{ prefix }}-{{ highestSeq }}</template>
        </i18n-t>
        <i18n-t v-else-if="nextValid" keypath="settings.general.seqContinueFresh" tag="span">
          <template #id><b>{{ prefix }}-{{ nextSeq }}</b></template>
        </i18n-t>
        <span v-else>
          {{ t("settings.general.seqInvalid", { min: n(minNext, "integer"), max: n(MAX_SEQ, "integer") }) }}
        </span>
      </p>
    </section>

    <section class="sheet-section">
      <div class="sheet-section-head">
        <span class="sheet-label">{{ t("settings.general.planning") }}</span>
      </div>
      <ToggleSwitch
        v-model="pointsEnabled"
        :label="t('settings.general.storyPoints')"
        :hint="t('settings.general.storyPointsHint')"
      />
      <p v-if="!pointsEnabled && props.pointsEnabled" class="sheet-note">
        {{ t("settings.general.pointsHidden") }}
      </p>
      <ToggleSwitch
        v-model="dependenciesEnabled"
        class="toggle-gap"
        :label="t('settings.general.dependencies')"
        :hint="t('settings.general.dependenciesHint')"
      />
      <p v-if="!dependenciesEnabled && props.dependenciesEnabled" class="sheet-note">
        {{ t("settings.general.dependenciesHidden") }}
      </p>
    </section>

    <section class="sheet-section">
      <div class="sheet-section-head">
        <span class="sheet-label">{{ t("settings.general.density.aria") }}</span>
      </div>
      <div class="density-grid" role="radiogroup" :aria-label="t('settings.general.density.aria')">
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
          <span class="density-label">{{ t(opt.labelKey) }}</span>
          <span class="density-hint">{{ t(opt.hintKey) }}</span>
        </button>
      </div>
      <p class="sheet-note">{{ t("settings.general.density.savedNote") }}</p>
    </section>

    <section class="sheet-section danger-zone">
      <div class="sheet-section-head">
        <span class="sheet-label">{{ t("settings.general.dangerZone") }}</span>
      </div>
      <p class="sheet-note danger-note">
        {{ t("settings.general.dangerNote") }}
      </p>

      <button v-if="!confirmingDelete" class="btn danger" type="button" @click="confirmingDelete = true">
        {{ t("settings.general.deleteBoard") }}
      </button>
      <template v-else>
        <label class="delete-hint" for="delete-board-confirm">
          <i18n-t keypath="settings.general.deleteConfirm">
            <template #title><b>{{ props.title }}</b></template>
          </i18n-t>
        </label>
        <div class="delete-row">
          <input
            id="delete-board-confirm"
            v-model="deleteConfirm"
            type="text"
            class="sheet-input"
            :placeholder="props.title"
            autocomplete="off"
            spellcheck="false"
            @keydown.enter.prevent="removeBoard"
          />
          <button class="btn danger" type="button" :disabled="!canDelete || deleting" @click="removeBoard">
            {{ deleting ? t("settings.general.deleting") : t("settings.general.deletePermanently") }}
          </button>
          <button class="btn secondary" type="button" :disabled="deleting" @click="cancelDelete">{{ t("common.cancel") }}</button>
        </div>
      </template>
    </section>

    <p v-if="error" class="sheet-error">{{ error }}</p>

    <template #footer>
      <button class="btn secondary" type="button" @click="emit('close')">{{ t("common.cancel") }}</button>
      <button class="btn" type="button" :disabled="saving" @click="save">
        {{ saving ? t("settings.general.saving") : t("common.save") }}
      </button>
    </template>
  </ModalShell>
</template>

<style scoped>
.title-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.title-row .sheet-input {
  flex: 1;
}

.icon-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(42px, 1fr));
  gap: 6px;
}
.icon-opt {
  display: grid;
  place-items: center;
  height: 42px;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  transition: border-color 0.15s ease, background 0.15s ease;
}
.icon-opt:hover {
  border-color: color-mix(in srgb, var(--border) 45%, var(--text));
}
.icon-opt[aria-checked="true"] {
  border-color: var(--accent);
  background: var(--accent-soft);
}
.icon-opt:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.toggle-gap {
  margin-top: 8px;
}

.danger-zone .sheet-label {
  color: var(--danger);
}
.danger-note {
  margin: 0 0 12px;
}
.delete-hint {
  display: block;
  margin-bottom: 8px;
  font-size: 13px;
  color: var(--text);
}
.delete-hint b {
  overflow-wrap: anywhere;
}
.delete-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.delete-row .sheet-input {
  flex: 1;
  min-width: 0;
}
.delete-row .btn {
  flex: none;
}

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
  .delete-row {
    flex-wrap: wrap;
  }
  .delete-row .sheet-input {
    flex-basis: 100%;
  }
}
</style>
