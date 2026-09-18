<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  addDependency,
  removeDependency,
  createCard,
  updateCard,
  deleteCard,
  ApiError,
  type Card,
  type Column,
  type Dependency,
  type Priority,
  type Tag,
} from "../api";
import { renderMarkdown } from "../lib/markdown";
import PriorityIcon from "./PriorityIcon.vue";
import CardActivity from "./CardActivity.vue";
import CardDependencies from "./CardDependencies.vue";
import CardComments from "./CardComments.vue";

const props = defineProps<{
  boardId: string;
  prefix: string;
  boardTitle?: string;
  readOnly: boolean;
  card: Card | null; // null => create mode
  initialColumnId?: number;
  boardTags: Tag[];
  boardColumns: Column[];
  boardPriorities: Priority[];
  pointsEnabled: boolean;
  dependenciesEnabled: boolean;
  dependencies: Dependency[];
  allCards: Card[];
  doneColumnId: number | null;
}>();

const emit = defineEmits<{
  close: [];
  saved: [card: Card];
  deleted: [id: number];
  dependenciesChanged: [dependencies: Dependency[]];
  navigate: [card: Card];
  commentCount: [cardId: number, count: number];
}>();

const route = useRoute();
const router = useRouter();

const isNew = props.card === null;
const title = ref(props.card?.title ?? "");
const body = ref(props.card?.body ?? "");
const columnId = ref<number>(props.card?.columnId ?? props.initialColumnId ?? props.boardColumns[0]?.id ?? 0);
const priorityId = ref<number | null>(props.card?.priorityId ?? null);
const points = ref<number | null>(props.card?.points ?? null);
const POINT_SCALE = [1, 2, 3, 5, 8, 13, 21];
const MAX_POINTS = 100;
const selectedTagIds = ref<number[]>(props.card?.tags?.map((t) => t.id) ?? []);
// Description opens straight into edit mode; read-only viewers only ever see the preview.
const mode = ref<"edit" | "preview">(props.readOnly ? "preview" : "edit");
const saving = ref(false);
// Bumped when comments change so the activity list reloads with the new entry.
const activityKey = ref(0);

// Dependencies are edited as a draft of the board's links and written on Save.
// A card that doesn't exist yet uses a placeholder id until it's created.
const NEW_CARD_ID = -1;
const selfId = props.card?.id ?? NEW_CARD_ID;
const depDraft = ref<Dependency[]>([...props.dependencies]);

function ownLinks(list: Dependency[]) {
  return list
    .filter((d) => d.blockedId === selfId || d.blockerId === selfId)
    .map((d) => `${d.blockedId}>${d.blockerId}`)
    .sort();
}
const archiving = ref(false);
const isArchived = computed(() => !!props.card?.archivedAt);
const deleting = ref(false);
const confirmingDelete = ref(false);
const confirmingDiscard = ref(false);
const tagPickerOpen = ref(false);
const error = ref("");

const titleEl = ref<HTMLTextAreaElement | null>(null);
const bodyEl = ref<HTMLTextAreaElement | null>(null);
const tagPickerEl = ref<HTMLElement | null>(null);

const snapshot = JSON.stringify([title.value, body.value, columnId.value, priorityId.value, points.value, [...selectedTagIds.value].sort(), ownLinks(depDraft.value)]);
const dirty = computed(
  () => JSON.stringify([title.value, body.value, columnId.value, priorityId.value, points.value, [...selectedTagIds.value].sort(), ownLinks(depDraft.value)]) !== snapshot
);

const displayId = computed(() => (props.card ? `${props.prefix}-${props.card.seq}` : "New card"));
const currentPriority = computed(() => props.boardPriorities.find((p) => p.id === priorityId.value) ?? null);
const currentColumn = computed(() => props.boardColumns.find((c) => c.id === columnId.value));
const selectedTags = computed(() => props.boardTags.filter((t) => selectedTagIds.value.includes(t.id)));
const availableTags = computed(() => props.boardTags.filter((t) => !selectedTagIds.value.includes(t.id)));
const preview = computed(() => renderMarkdown(body.value));

const dateFmt = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" });
function formatDate(iso: string) {
  return dateFmt.format(new Date(iso));
}

function autoGrow(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

watch(title, () => autoGrow(titleEl.value));

function setMode(next: "edit" | "preview") {
  mode.value = next;
  if (next === "edit") nextTick(() => bodyEl.value?.focus({ preventScroll: true }));
}

function setPoints(value: number | null) {
  if (props.readOnly) return;
  points.value = points.value === value ? null : value;
}

function onPointsInput(e: Event) {
  const raw = (e.target as HTMLInputElement).value.trim();
  if (raw === "") {
    points.value = null;
    return;
  }
  const n = Number(raw);
  if (Number.isInteger(n) && n >= 0 && n <= MAX_POINTS) points.value = n;
}

function addTag(id: number) {
  if (props.readOnly) return;
  if (!selectedTagIds.value.includes(id)) selectedTagIds.value.push(id);
  if (!availableTags.value.length) tagPickerOpen.value = false;
}

function removeTag(id: number) {
  if (props.readOnly) return;
  const i = selectedTagIds.value.indexOf(id);
  if (i >= 0) selectedTagIds.value.splice(i, 1);
}

const PLACEHOLDER_TITLE = "Untitled";

async function save(opts: { usePlaceholder?: boolean; archived?: boolean } = {}) {
  if (saving.value) return;
  error.value = "";
  const trimmedTitle = title.value.trim() || (opts.usePlaceholder ? PLACEHOLDER_TITLE : "");
  if (!trimmedTitle) {
    error.value = "Title is required";
    titleEl.value?.focus();
    return;
  }
  saving.value = true;
  try {
    if (isNew) {
      const created = await createCard(props.boardId, {
        title: trimmedTitle,
        body: body.value,
        columnId: columnId.value,
        priorityId: priorityId.value,
        ...(props.pointsEnabled ? { points: points.value } : {}),
        tagIds: selectedTagIds.value,
      });
      if (!(await persistDependencies(created.id))) return;
      emit("saved", created);
    } else {
      const updated = await updateCard(props.boardId, props.card!.id, {
        title: trimmedTitle,
        body: body.value,
        columnId: columnId.value,
        priorityId: priorityId.value,
        ...(props.pointsEnabled ? { points: points.value } : {}),
        tagIds: selectedTagIds.value,
        ...(opts.archived !== undefined ? { archived: opts.archived } : {}),
      });
      if (!(await persistDependencies(updated.id))) return;
      emit("saved", updated);
    }
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : "Failed to save card";
  } finally {
    saving.value = false;
  }
}

// Applies the draft's changes to this card's links. Returns false (and keeps the modal
// open) if any request failed; the card itself is already saved at that point.
async function persistDependencies(cardId: number): Promise<boolean> {
  if (!props.dependenciesEnabled) return true;
  const resolve = (id: number) => (id === NEW_CARD_ID ? cardId : id);
  const key = (d: Dependency) => `${d.blockedId}>${d.blockerId}`;
  const before = props.dependencies.filter((d) => d.blockedId === selfId || d.blockerId === selfId);
  const after = depDraft.value
    .filter((d) => d.blockedId === selfId || d.blockerId === selfId)
    .map((d) => ({ blockedId: resolve(d.blockedId), blockerId: resolve(d.blockerId) }));
  const beforeKeys = new Set(before.map(key));
  const afterKeys = new Set(after.map(key));
  const removed = before.filter((d) => !afterKeys.has(key(d)));
  const added = after.filter((d) => !beforeKeys.has(key(d)));
  if (!removed.length && !added.length) return true;

  let result = props.dependencies.slice();
  let failure = "";
  for (const d of removed) {
    try {
      await removeDependency(props.boardId, d.blockedId, d.blockerId);
      result = result.filter((x) => key(x) !== key(d));
    } catch (e) {
      failure = e instanceof ApiError ? e.message : "Couldn't remove a dependency";
    }
  }
  for (const d of added) {
    try {
      await addDependency(props.boardId, d.blockedId, d.blockerId);
      result = [...result, d];
    } catch (e) {
      failure = e instanceof ApiError ? e.message : "Couldn't add a dependency";
    }
  }
  emit("dependenciesChanged", result);
  if (failure && !isNew) {
    depDraft.value = result;
    error.value = `Card saved, but a dependency wasn't: ${failure}`;
    return false;
  }
  return true;
}

// Set when a link inside the card was followed while there were unsaved edits.
const pendingNavigation = ref<Card | null>(null);

function requestClose() {
  if (!props.readOnly && dirty.value) {
    pendingNavigation.value = null;
    confirmingDiscard.value = true;
    return;
  }
  emit("close");
}

function openLinkedCard(target: Card) {
  if (!props.readOnly && dirty.value) {
    pendingNavigation.value = target;
    confirmingDiscard.value = true;
    return;
  }
  emit("navigate", target);
}

function discardChanges() {
  if (pendingNavigation.value) emit("navigate", pendingNavigation.value);
  else emit("close");
}

function keepEditing() {
  confirmingDiscard.value = false;
  pendingNavigation.value = null;
}

const copyState = ref<"idle" | "copied" | "failed">("idle");
let copyTimer: ReturnType<typeof setTimeout> | undefined;

async function copyLink() {
  if (!props.card) return;
  const href = router.resolve({ query: { ...route.query, card: String(props.card.seq) } }).href;
  try {
    await navigator.clipboard.writeText(new URL(href, window.location.origin).toString());
    copyState.value = "copied";
  } catch {
    copyState.value = "failed";
  }
  clearTimeout(copyTimer);
  copyTimer = setTimeout(() => (copyState.value = "idle"), 1600);
}

const backdropArmed = ref(false);

function handleBackdrop() {
  if (!backdropArmed.value) return;
  backdropArmed.value = false;
  if (props.readOnly || (!isNew && !dirty.value)) {
    emit("close");
    return;
  }
  save({ usePlaceholder: true });
}

// Archiving also saves any pending edits, then closes the modal.
async function setArchived(archived: boolean) {
  if (isNew || archiving.value) return;
  archiving.value = true;
  try {
    await save({ archived });
  } finally {
    archiving.value = false;
  }
}

async function remove() {
  if (!props.card) return;
  deleting.value = true;
  error.value = "";
  try {
    await deleteCard(props.boardId, props.card.id);
    emit("deleted", props.card.id);
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : "Failed to delete card";
    confirmingDelete.value = false;
  } finally {
    deleting.value = false;
  }
}

function onKeydown(e: KeyboardEvent) {
  // Inner widgets (e.g. the dependency search) claim Escape with preventDefault.
  if (e.key === "Escape" && e.defaultPrevented) return;
  if (e.key === "Escape") {
    e.preventDefault();
    if (tagPickerOpen.value) tagPickerOpen.value = false;
    else if (confirmingDelete.value) confirmingDelete.value = false;
    else if (confirmingDiscard.value) keepEditing();
    else requestClose();
    return;
  }
  // The comment composer claims Ctrl/Cmd+Enter to post instead of saving the card.
  if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && !props.readOnly && !e.defaultPrevented) {
    e.preventDefault();
    save();
  }
}

function onDocClick(e: MouseEvent) {
  if (tagPickerOpen.value && tagPickerEl.value && !tagPickerEl.value.contains(e.target as Node)) {
    tagPickerOpen.value = false;
  }
}

onMounted(() => {
  document.addEventListener("keydown", onKeydown);
  document.addEventListener("mousedown", onDocClick);
  autoGrow(titleEl.value);
  if (props.readOnly) return;
  if (isNew) titleEl.value?.focus();
  else bodyEl.value?.focus({ preventScroll: true });
});

onBeforeUnmount(() => {
  document.removeEventListener("keydown", onKeydown);
  document.removeEventListener("mousedown", onDocClick);
});
</script>

<template>
  <div class="overlay" @mousedown.self="backdropArmed = true" @click.self="handleBackdrop">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="card-title">
      <div class="m-head">
        <div class="m-head-left">
          <span class="key">{{ displayId }}</span>
          <span v-if="isArchived" class="archived-pill">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="4" width="18" height="5" rx="1.5" />
              <path d="M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9M10 13h4" />
            </svg>
            Archived
          </span>
          <span class="crumb">
            <template v-if="boardTitle">{{ boardTitle }} <b>/</b> </template>{{ currentColumn?.name ?? "" }}
          </span>
        </div>
        <div class="m-head-right">
          <button
            v-if="card"
            class="close-btn"
            :class="{ copied: copyState === 'copied' }"
            type="button"
            :title="copyState === 'copied' ? 'Link copied' : copyState === 'failed' ? 'Couldn’t copy — use the address bar' : 'Copy link to this card'"
            :aria-label="copyState === 'copied' ? 'Link copied' : 'Copy link to this card'"
            @click="copyLink"
          >
            <svg v-if="copyState === 'copied'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
            <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
              <path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5" />
              <path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1.5-1.5" />
            </svg>
          </button>
          <button class="close-btn" type="button" title="Close (Esc)" aria-label="Close" @click="requestClose">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
      </div>

      <div class="m-body">
        <div class="m-main">
          <textarea
            id="card-title"
            ref="titleEl"
            v-model="title"
            class="title-input"
            rows="1"
            maxlength="255"
            placeholder="Card title"
            aria-label="Card title"
            :readonly="readOnly"
            @keydown.enter.exact.prevent="setMode('edit')"
          />

          <div v-if="card" class="sub-meta">
            <span>Created {{ formatDate(card.createdAt) }}</span>
            <span class="dot-sep" />
            <span>Updated {{ formatDate(card.updatedAt) }}</span>
          </div>

          <div class="block-head">
            <span class="label">Description</span>
            <div v-if="!readOnly" class="seg" role="group" aria-label="Description mode">
              <button type="button" :aria-pressed="mode === 'edit'" @click="setMode('edit')">Edit</button>
              <button type="button" :aria-pressed="mode === 'preview'" @click="setMode('preview')">Preview</button>
            </div>
          </div>

          <div class="editor-shell">
            <textarea
              v-if="mode === 'edit' && !readOnly"
              ref="bodyEl"
              v-model="body"
              class="md-input"
              aria-label="Description (Markdown)"
              placeholder="Describe the problem, expected behavior and acceptance criteria…"
            />
            <div v-else class="md-preview">
              <div v-if="preview" class="markdown-body" v-html="preview" />
              <p v-else class="empty">No description yet.</p>
            </div>
            <div v-if="!readOnly" class="md-foot">
              <span>Markdown supported · <kbd>Ctrl</kbd> <kbd>↵</kbd> saves</span>
              <span>{{ body.length }} chars</span>
            </div>
          </div>

          <p v-if="error" class="error">{{ error }}</p>

          <CardComments
            v-if="card"
            :board-id="boardId"
            :card-id="card.id"
            :read-only="readOnly"
            @count-changed="emit('commentCount', card.id, $event)"
            @changed="activityKey++"
          />
        </div>

        <aside class="m-rail">
          <section class="rail-sec">
            <div class="rail-sec-head"><span class="label">Column</span></div>
            <div class="select-wrap">
              <span class="dot" :style="{ background: currentColumn?.color || 'var(--muted)' }" />
              <select v-model="columnId" :disabled="readOnly" aria-label="Column">
                <option v-for="col in boardColumns" :key="col.id" :value="col.id">{{ col.name }}</option>
              </select>
              <svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </div>
          </section>

          <section class="rail-sec">
            <div class="rail-sec-head"><span class="label">Priority</span></div>
            <div class="select-wrap">
              <span class="select-icon"><PriorityIcon :color="currentPriority?.color" :size="14" /></span>
              <select v-model="priorityId" :disabled="readOnly" aria-label="Priority">
                <option :value="null">No priority</option>
                <option v-for="p in boardPriorities" :key="p.id" :value="p.id">{{ p.name }}</option>
              </select>
              <svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </div>
          </section>

          <section v-if="pointsEnabled" class="rail-sec">
            <div class="rail-sec-head">
              <span class="label">Story points</span>
              <button
                v-if="points !== null && !readOnly"
                type="button"
                class="clear-link"
                @click="points = null"
              >
                Clear
              </button>
            </div>
            <div class="points" role="radiogroup" aria-label="Story points">
              <button
                v-for="n in POINT_SCALE"
                :key="n"
                type="button"
                role="radio"
                class="point-chip"
                :aria-checked="points === n"
                :disabled="readOnly"
                @click="setPoints(n)"
              >
                {{ n }}
              </button>
              <input
                class="point-input"
                :class="{ custom: points !== null && !POINT_SCALE.includes(points) }"
                type="number"
                min="0"
                :max="MAX_POINTS"
                step="1"
                inputmode="numeric"
                placeholder="#"
                aria-label="Custom story points"
                :value="points !== null && !POINT_SCALE.includes(points) ? points : ''"
                :disabled="readOnly"
                @change="onPointsInput"
              />
            </div>
            <p v-if="points === null" class="rail-empty">Not estimated</p>
          </section>

          <section class="rail-sec">
            <div class="rail-sec-head">
              <span class="label">Tags</span>
              <span class="count">{{ selectedTags.length }}</span>
            </div>
            <div v-if="boardTags.length" class="tags">
              <span v-for="tag in selectedTags" :key="tag.id" class="tag">
                <span>{{ tag.name }}</span>
                <button
                  v-if="!readOnly"
                  type="button"
                  class="x"
                  :aria-label="`Remove tag ${tag.name}`"
                  @click="removeTag(tag.id)"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round">
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </span>
              <div v-if="!readOnly && availableTags.length" ref="tagPickerEl" class="tag-picker">
                <button type="button" class="tag-add" :aria-expanded="tagPickerOpen" @click="tagPickerOpen = !tagPickerOpen">
                  <span aria-hidden="true">+</span> Add
                </button>
                <ul v-if="tagPickerOpen" class="tag-menu" role="listbox">
                  <li v-for="tag in availableTags" :key="tag.id">
                    <button type="button" class="tag-opt" role="option" @click="addTag(tag.id)">{{ tag.name }}</button>
                  </li>
                </ul>
              </div>
              <span v-if="readOnly && !selectedTags.length" class="rail-empty">No tags</span>
            </div>
            <div v-else class="rail-empty">No tags yet — add them in board settings.</div>
          </section>

          <section v-if="dependenciesEnabled" class="rail-sec">
            <CardDependencies
              v-model:dependencies="depDraft"
              :card-id="selfId"
              :prefix="prefix"
              :read-only="readOnly"
              :all-cards="allCards"
              :columns="boardColumns"
              :done-column-id="doneColumnId"
              @open="openLinkedCard"
            />
          </section>

          <section v-if="card" class="rail-sec">
            <CardActivity :key="activityKey" :card-id="card.id" />
          </section>
        </aside>
      </div>

      <div v-if="!readOnly" class="m-foot">
        <div>
          <template v-if="!isNew">
            <div v-if="confirmingDelete" class="confirm">
              <span>Delete {{ displayId }} permanently?</span>
              <button type="button" class="go" :disabled="deleting" @click="remove">
                {{ deleting ? "Deleting..." : "Delete" }}
              </button>
              <button type="button" class="no" @click="confirmingDelete = false">Cancel</button>
            </div>
            <div v-else class="foot-left">
              <button
                type="button"
                class="btn-ghost"
                :disabled="archiving || saving"
                @click="setArchived(!isArchived)"
              >
                <svg v-if="isArchived" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" />
                </svg>
                <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="4" width="18" height="5" rx="1.5" />
                  <path d="M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9M10 13h4" />
                </svg>
                {{ isArchived ? "Restore" : archiving ? "Archiving..." : "Archive" }}
              </button>
              <button type="button" class="btn-ghost-danger" @click="confirmingDelete = true">Delete card</button>
            </div>
          </template>
        </div>

        <div v-if="confirmingDiscard" class="confirm">
          <span>
            {{ pendingNavigation ? `Discard unsaved changes and open ${prefix}-${pendingNavigation.seq}?` : "Discard unsaved changes?" }}
          </span>
          <button type="button" class="go" @click="discardChanges">Discard</button>
          <button type="button" class="no" @click="keepEditing">Keep editing</button>
        </div>
        <div v-else class="foot-right">
          <span v-if="dirty" class="dirty"><span class="dot" />Unsaved changes</span>
          <button type="button" class="btn secondary" @click="requestClose">Cancel</button>
          <button type="button" class="btn" :disabled="saving || (!isNew && !dirty)" @click="save()">
            {{ saving ? "Saving..." : "Save" }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  --mono: ui-monospace, SFMono-Regular, "JetBrains Mono", Menlo, monospace;
  --soft: color-mix(in srgb, var(--text) 7%, transparent);
  --sunken: color-mix(in srgb, var(--text) 4%, var(--surface));
  --rail: color-mix(in srgb, var(--text) 2.5%, var(--panel));
  --accent-soft: color-mix(in srgb, var(--accent) 16%, transparent);

  position: fixed;
  inset: 0;
  background: var(--overlay-bg);
  backdrop-filter: blur(4px);
  display: grid;
  place-items: center;
  padding: 32px;
  z-index: 100;
  animation: fade 0.16s ease-out;
}

@keyframes fade {
  from { opacity: 0; }
}
@keyframes rise {
  from { opacity: 0; transform: translateY(8px) scale(0.99); }
}

.modal {
  width: min(1140px, 100%);
  height: min(740px, calc(100vh - 64px));
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 14px;
  box-shadow: 0 32px 80px -24px var(--shadow-color);
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  overflow: hidden;
  animation: rise 0.2s cubic-bezier(0.2, 0.8, 0.3, 1);
}

@media (prefers-reduced-motion: reduce) {
  .overlay,
  .modal { animation: none; }
}

/* header */
.m-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 16px 12px 22px;
  border-bottom: 1px solid var(--border);
}
.m-head-left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}
.key {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.06em;
  color: var(--accent);
  background: var(--accent-soft);
  padding: 4px 9px;
  border-radius: 6px;
  white-space: nowrap;
}
.crumb {
  font-size: 13px;
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.crumb b { font-weight: 500; }
.close-btn {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  background: none;
  border: 1px solid transparent;
  color: var(--muted);
  flex: none;
}
.close-btn:hover {
  background: var(--soft);
  color: var(--text);
  border-color: var(--border);
}
.close-btn svg { width: 17px; height: 17px; }
.close-btn.copied { color: var(--success-border); }
.m-head-right {
  display: flex;
  align-items: center;
  gap: 2px;
  flex: none;
}

/* body: large main column + narrower attribute rail */
.m-body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  min-height: 0;
}
.m-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  padding: 24px 30px;
  overflow-y: auto;
}

.title-input {
  width: calc(100% + 20px);
  background: transparent;
  border: 1px solid transparent;
  border-radius: 10px;
  padding: 6px 10px;
  margin: -6px -10px 0;
  font-size: 26px;
  font-weight: 600;
  letter-spacing: -0.02em;
  line-height: 1.22;
  resize: none;
  overflow: hidden;
  color: var(--text);
}
.title-input:not([readonly]):hover { background: var(--soft); }
.title-input:focus {
  outline: none;
  background: var(--sunken);
  border-color: var(--border);
}
.title-input[readonly]:focus { background: transparent; border-color: transparent; }
.title-input::placeholder { color: var(--muted); }

.sub-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 10px;
  font-size: 11.5px;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  color: var(--muted);
}
.dot-sep {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: var(--muted);
  opacity: 0.6;
}

.block-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 24px 0 10px;
}
.label {
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--muted);
}

.seg {
  display: inline-flex;
  gap: 2px;
  padding: 3px;
  background: var(--sunken);
  border: 1px solid var(--border);
  border-radius: 9px;
}
.seg button {
  padding: 4px 12px;
  border: 0;
  border-radius: 6px;
  background: none;
  font-size: 13px;
  color: var(--muted);
}
.seg button:hover { color: var(--text); background: var(--soft); }
.seg button[aria-pressed="true"] {
  background: var(--panel);
  color: var(--text);
  box-shadow: 0 1px 2px var(--shadow-color);
}

.editor-shell {
  flex: 1;
  min-height: 260px;
  display: flex;
  flex-direction: column;
  background: var(--sunken);
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
}
.editor-shell:focus-within { border-color: color-mix(in srgb, var(--accent) 70%, var(--border)); }
.md-input {
  flex: 1;
  width: 100%;
  min-height: 220px;
  resize: none;
  padding: 16px 18px;
  background: transparent;
  border: 0;
  outline: none;
  color: var(--text);
  font-family: var(--mono);
  font-size: 13.5px;
  line-height: 1.7;
}
.md-input::placeholder { color: var(--muted); }
.md-preview {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
  font-size: 15px;
  line-height: 1.6;
}
.md-preview .empty {
  color: var(--muted);
  font-style: italic;
  margin: 0;
}
.markdown-body > :deep(:first-child) { margin-top: 0; }
.markdown-body > :deep(:last-child) { margin-bottom: 0; }
.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3) {
  letter-spacing: -0.01em;
  margin: 20px 0 8px;
}
.markdown-body :deep(h1) { font-size: 20px; }
.markdown-body :deep(h2) { font-size: 18px; }
.markdown-body :deep(h3) { font-size: 15px; }
.markdown-body :deep(p),
.markdown-body :deep(ul),
.markdown-body :deep(ol) { margin: 0 0 12px; }
.markdown-body :deep(ul),
.markdown-body :deep(ol) { padding-left: 22px; }
.markdown-body :deep(li) { margin-bottom: 4px; }
.markdown-body :deep(li::marker) { color: var(--muted); }
.markdown-body :deep(code) {
  font-family: var(--mono);
  font-size: 0.86em;
  padding: 1px 5px;
  background: var(--soft);
  border: 1px solid var(--border);
  border-radius: 5px;
}
.markdown-body :deep(pre) {
  background: var(--soft);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px 12px;
  overflow-x: auto;
}
.markdown-body :deep(pre code) { background: none; border: 0; padding: 0; }
.markdown-body :deep(blockquote) {
  margin: 0 0 12px;
  padding: 2px 0 2px 14px;
  border-left: 2px solid var(--border);
  color: var(--muted);
}
.markdown-body :deep(a) {
  color: var(--accent);
  text-underline-offset: 2px;
}

.md-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 7px 14px;
  border-top: 1px solid var(--border);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--muted);
}
.md-foot kbd {
  font-family: var(--mono);
  font-size: 10px;
  padding: 1px 5px;
  border: 1px solid var(--border);
  border-radius: 4px;
}

.error {
  color: var(--danger);
  font-size: 13px;
  margin: 10px 0 0;
}

/* attribute rail */
.m-rail {
  background: var(--rail);
  border-left: 1px solid var(--border);
  overflow-y: auto;
  padding: 22px;
  min-width: 0;
}
.rail-sec + .rail-sec {
  margin-top: 22px;
  padding-top: 22px;
  border-top: 1px solid var(--border);
}
.rail-sec-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 12px;
}
.count {
  font-size: 11px;
  color: var(--muted);
  background: var(--soft);
  border-radius: 999px;
  padding: 1px 7px;
}
.clear-link {
  padding: 2px 6px;
  margin-right: -6px;
  border: 0;
  border-radius: 6px;
  background: none;
  color: var(--muted);
  font-size: 12px;
}
.clear-link:hover {
  background: var(--soft);
  color: var(--text);
}
.points {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}
.point-chip,
.point-input {
  min-width: 34px;
  height: 30px;
  padding: 0 8px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text);
  font-size: 13px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  transition: border-color 0.15s ease, background 0.15s ease;
}
.point-chip:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--border) 45%, var(--text));
}
.point-chip[aria-checked="true"],
.point-input.custom {
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--accent);
}
.point-chip:disabled {
  cursor: default;
}
.point-input {
  width: 52px;
  text-align: center;
}
.point-input:focus {
  outline: none;
  border-color: var(--accent);
}
.point-input::placeholder {
  color: var(--muted);
  font-weight: 400;
}
.points + .rail-empty {
  margin: 8px 0 0;
}

.rail-empty {
  font-size: 13px;
  color: var(--muted);
}

.select-wrap {
  position: relative;
  display: flex;
  align-items: center;
}
.select-wrap .dot {
  position: absolute;
  left: 11px;
  pointer-events: none;
}
.select-wrap .select-icon {
  position: absolute;
  left: 9px;
  pointer-events: none;
}
.select-wrap .chev {
  position: absolute;
  right: 10px;
  width: 13px;
  height: 13px;
  color: var(--muted);
  pointer-events: none;
}
.select-wrap select {
  appearance: none;
  width: 100%;
  min-height: 36px;
  padding: 6px 30px 6px 27px;
  border: 1px solid var(--border);
  border-radius: 8px;
  font-size: 13.5px;
}
.select-wrap select:not(:disabled):hover { border-color: color-mix(in srgb, var(--border) 50%, var(--text)); }
.select-wrap select:focus { outline: none; border-color: var(--accent); }
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex: none;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
.tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--surface);
  font-size: 12.5px;
}
.tag:has(.x) { padding-right: 5px; }
.tag .x {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  padding: 0;
  border: 0;
  background: none;
  color: var(--muted);
}
.tag .x:hover {
  background: color-mix(in srgb, var(--danger) 18%, transparent);
  color: var(--danger);
}
.tag .x svg { width: 9px; height: 9px; }
.tag-picker { position: relative; }
.tag-add {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 11px;
  border-radius: 999px;
  border: 1px dashed var(--border);
  background: none;
  color: var(--muted);
  font-size: 12.5px;
}
.tag-add:hover {
  color: var(--text);
  border-color: var(--muted);
  background: var(--soft);
}
.tag-menu {
  position: absolute;
  z-index: 5;
  top: calc(100% + 5px);
  left: 0;
  min-width: 180px;
  max-height: 232px;
  overflow-y: auto;
  margin: 0;
  padding: 5px;
  list-style: none;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: 0 18px 40px -16px var(--shadow-color);
}
.tag-opt {
  display: block;
  width: 100%;
  padding: 7px 9px;
  border: 0;
  border-radius: 7px;
  background: none;
  color: var(--text);
  font-size: 13.5px;
  text-align: left;
}
.tag-opt:hover { background: var(--soft); }

/* footer */
.m-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 20px;
  border-top: 1px solid var(--border);
}
.foot-right {
  display: flex;
  align-items: center;
  gap: 10px;
}
.dirty {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 11px;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  color: var(--warning-text);
}
.dirty .dot { background: currentColor; }
.archived-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 9px 3px 7px;
  border-radius: 999px;
  background: var(--soft);
  border: 1px solid var(--border);
  color: var(--muted);
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}
.archived-pill svg {
  width: 12px;
  height: 12px;
}
.foot-left {
  display: flex;
  align-items: center;
  gap: 4px;
}
.btn-ghost {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: none;
  border: 0;
  border-radius: 6px;
  padding: 8px 12px;
  color: var(--text);
  font-weight: 600;
}
.btn-ghost:hover:not(:disabled) {
  background: var(--soft);
}
.btn-ghost:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.btn-ghost svg {
  width: 15px;
  height: 15px;
  color: var(--muted);
}
.btn-ghost-danger {
  background: none;
  border: 0;
  border-radius: 6px;
  padding: 8px 12px;
  color: var(--danger);
  font-weight: 600;
}
.btn-ghost-danger:hover { background: color-mix(in srgb, var(--danger) 12%, transparent); }
.confirm {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.confirm span {
  font-size: 13px;
  color: var(--danger);
}
.confirm .go {
  font-size: 13px;
  font-weight: 600;
  padding: 7px 12px;
  border: 0;
  border-radius: 6px;
  color: #fff;
  background: var(--danger);
}
.confirm .go:hover { background: var(--danger-hover); }
.confirm .no {
  font-size: 13px;
  padding: 7px 8px;
  border: 0;
  border-radius: 6px;
  background: none;
  color: var(--muted);
}
.confirm .no:hover { color: var(--text); background: var(--soft); }

/* narrow screens: full-screen sheet, rail stacks under the description */
@media (max-width: 860px) {
  .overlay { padding: 0; }
  .modal {
    width: 100%;
    height: 100dvh;
    border: 0;
    border-radius: 0;
  }
  .m-body {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto auto;
    overflow-y: auto;
  }
  .m-main { overflow: visible; padding: 20px 18px; }
  .m-rail {
    border-left: 0;
    border-top: 1px solid var(--border);
    overflow: visible;
  }
  .editor-shell { min-height: 220px; }
  .m-foot { padding: 12px 16px; flex-wrap: wrap; }
}
</style>
