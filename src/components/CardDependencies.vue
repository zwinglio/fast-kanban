<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import type { Card, Column, Dependency } from "../api";
import { parseCardNumber } from "../lib/cardSearch";

const MAX_RESULTS = 8;

// Edits a draft of the board's links; the card modal persists them on Save like every other field.
const props = defineProps<{
  cardId: number; // may be a placeholder for a card that isn't created yet
  prefix: string;
  readOnly: boolean;
  dependencies: Dependency[];
  allCards: Card[];
  columns: Column[];
  doneColumnId: number | null;
}>();

const emit = defineEmits<{
  "update:dependencies": [dependencies: Dependency[]];
  open: [card: Card];
}>();

const route = useRoute();
const router = useRouter();

function cardHref(c: Card) {
  return router.resolve({ query: { ...route.query, card: String(c.seq) } }).href;
}

// Plain clicks open the card in place (the modal can guard unsaved edits);
// modified or middle clicks keep normal link behaviour, e.g. a new tab.
function onLinkClick(e: MouseEvent, c: Card) {
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  e.preventDefault();
  emit("open", c);
}

type Mode = "blocked_by" | "blocks";

const adding = ref(false);
const mode = ref<Mode>("blocked_by");
const query = ref("");
const searchEl = ref<HTMLInputElement | null>(null);

const cardsById = computed(() => new Map(props.allCards.map((c) => [c.id, c])));
const columnsById = computed(() => new Map(props.columns.map((c) => [c.id, c])));

const blockers = computed(() =>
  props.dependencies
    .filter((d) => d.blockedId === props.cardId)
    .map((d) => cardsById.value.get(d.blockerId))
    .filter((c): c is Card => !!c)
);
const blocking = computed(() =>
  props.dependencies
    .filter((d) => d.blockerId === props.cardId)
    .map((d) => cardsById.value.get(d.blockedId))
    .filter((c): c is Card => !!c)
);
const openBlockers = computed(() => blockers.value.filter((c) => !isResolved(c)).length);

function isResolved(c: Card) {
  return !!c.archivedAt || c.columnId === props.doneColumnId;
}

function label(c: Card) {
  return `${props.prefix}-${c.seq}`;
}

// Same rule as the server: "blocked is blocked by blocker" loops if blocked already
// sits somewhere up blocker's chain of blockers.
function wouldLoop(blocked: number, blocker: number) {
  const blockersOf = new Map<number, number[]>();
  for (const d of props.dependencies) {
    const list = blockersOf.get(d.blockedId) ?? [];
    list.push(d.blockerId);
    blockersOf.set(d.blockedId, list);
  }
  const seen = new Set<number>();
  const stack = [blocker];
  while (stack.length) {
    const current = stack.pop()!;
    if (current === blocked) return true;
    if (seen.has(current)) continue;
    seen.add(current);
    stack.push(...(blockersOf.get(current) ?? []));
  }
  return false;
}

// Lower is better: the exact card number first, then numbers starting with what was typed,
// then title matches. -1 means no match.
function rank(c: Card, q: string, n: number | null): number {
  if (!q) return 3;
  if (n !== null) {
    if (c.seq === n) return 0;
    if (String(c.seq).startsWith(String(n))) return 1;
  }
  if (c.title.toLowerCase().includes(q)) return 2;
  if (label(c).toLowerCase().includes(q)) return 3;
  return -1;
}

const candidates = computed(() => {
  const linked = new Set((mode.value === "blocked_by" ? blockers.value : blocking.value).map((c) => c.id));
  const q = query.value.trim().toLowerCase();
  const n = parseCardNumber(q, props.prefix);
  return props.allCards
    .filter((c) => c.id !== props.cardId && !linked.has(c.id))
    .filter((c) =>
      mode.value === "blocked_by" ? !wouldLoop(props.cardId, c.id) : !wouldLoop(c.id, props.cardId)
    )
    .map((c) => ({ c, r: rank(c, q, n) }))
    .filter((x) => x.r >= 0)
    .sort(
      (a, b) =>
        a.r - b.r || Number(!!a.c.archivedAt) - Number(!!b.c.archivedAt) || (n !== null ? a.c.seq - b.c.seq : b.c.seq - a.c.seq)
    )
    .slice(0, MAX_RESULTS)
    .map((x) => x.c);
});

function openAdd(next: Mode = "blocked_by") {
  mode.value = next;
  adding.value = true;
  query.value = "";
  nextTick(() => searchEl.value?.focus());
}

function closeAdd() {
  adding.value = false;
  query.value = "";
}

function link(target: Card) {
  const blockedId = mode.value === "blocked_by" ? props.cardId : target.id;
  const blockerId = mode.value === "blocked_by" ? target.id : props.cardId;
  emit("update:dependencies", [...props.dependencies, { blockedId, blockerId }]);
  query.value = "";
  nextTick(() => searchEl.value?.focus());
}

function unlink(blockedId: number, blockerId: number) {
  emit(
    "update:dependencies",
    props.dependencies.filter((d) => !(d.blockedId === blockedId && d.blockerId === blockerId))
  );
}

function onSearchKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") {
    // Keep the card modal open; only close this picker.
    e.preventDefault();
    closeAdd();
  } else if (e.key === "Enter") {
    e.preventDefault();
    if (candidates.value[0]) link(candidates.value[0]);
  }
}
</script>

<template>
  <section class="deps" aria-label="Dependencies">
    <div class="deps-head">
      <span class="label">Dependencies</span>
      <span v-if="openBlockers" class="blocked-pill">Blocked · {{ openBlockers }}</span>
    </div>

    <div class="group">
      <div class="group-title">Blocked by</div>
      <ul v-if="blockers.length" class="dep-list">
        <li v-for="c in blockers" :key="c.id" class="dep" :class="{ resolved: isResolved(c) }">
          <span class="dep-status" :title="isResolved(c) ? 'Done' : columnsById.get(c.columnId)?.name">
            <svg v-if="isResolved(c)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
            <span v-else class="dot" :style="{ background: columnsById.get(c.columnId)?.color }" />
          </span>
          <a class="dep-link" :href="cardHref(c)" :title="`Open ${label(c)}: ${c.title}`" @click="onLinkClick($event, c)">
            <span class="dep-id">{{ label(c) }}</span>
            <span class="dep-title">{{ c.title }}</span>
          </a>
          <button
            v-if="!readOnly"
            type="button"
            class="dep-remove"
            :aria-label="`Remove: blocked by ${label(c)}`"
            @click="unlink(cardId, c.id)"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </li>
      </ul>
      <p v-else class="none">Nothing</p>
    </div>

    <div class="group">
      <div class="group-title">Blocks</div>
      <ul v-if="blocking.length" class="dep-list">
        <li v-for="c in blocking" :key="c.id" class="dep">
          <span class="dep-status" :title="columnsById.get(c.columnId)?.name">
            <span class="dot" :style="{ background: columnsById.get(c.columnId)?.color }" />
          </span>
          <a class="dep-link" :href="cardHref(c)" :title="`Open ${label(c)}: ${c.title}`" @click="onLinkClick($event, c)">
            <span class="dep-id">{{ label(c) }}</span>
            <span class="dep-title">{{ c.title }}</span>
          </a>
          <button
            v-if="!readOnly"
            type="button"
            class="dep-remove"
            :aria-label="`Remove: blocks ${label(c)}`"
            @click="unlink(c.id, cardId)"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </li>
      </ul>
      <p v-else class="none">Nothing</p>
    </div>

    <template v-if="!readOnly">
      <div v-if="adding" class="add-panel">
        <div class="seg" role="group" aria-label="Link type">
          <button type="button" :aria-pressed="mode === 'blocked_by'" @click="mode = 'blocked_by'">Blocked by</button>
          <button type="button" :aria-pressed="mode === 'blocks'" @click="mode = 'blocks'">Blocks</button>
        </div>
        <input
          ref="searchEl"
          v-model="query"
          type="text"
          class="search"
          :placeholder="`Card number (12, #12, ${prefix}-12) or title…`"
          aria-label="Find a card"
          @keydown="onSearchKeydown"
        />
        <ul class="results" role="listbox">
          <li v-for="c in candidates" :key="c.id">
            <button type="button" class="result" role="option" @click="link(c)">
              <span class="dot" :style="{ background: columnsById.get(c.columnId)?.color }" />
              <span class="dep-id">{{ label(c) }}</span>
              <span class="dep-title">{{ c.title }}</span>
              <span v-if="c.archivedAt" class="archived">archived</span>
            </button>
          </li>
          <li v-if="!candidates.length" class="none">No matching cards.</li>
        </ul>
        <div class="add-foot">
          <span>{{ mode === "blocked_by" ? "This card waits on the one you pick." : "The card you pick waits on this one." }}</span>
          <button type="button" class="link muted" @click="closeAdd">Done</button>
        </div>
      </div>
      <button v-else type="button" class="add-btn" @click="openAdd()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14" /></svg>
        Add dependency
      </button>
    </template>
  </section>
</template>

<style scoped>
.deps-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
}
.label {
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--muted);
}
.blocked-pill {
  padding: 1px 8px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--danger) 13%, transparent);
  color: var(--danger);
  font-size: 11.5px;
  font-weight: 600;
}

.group + .group {
  margin-top: 10px;
}
.group-title {
  margin-bottom: 4px;
  font-size: 12px;
  font-weight: 600;
  color: var(--muted);
}
.none {
  margin: 0;
  font-size: 13px;
  color: var(--muted);
  opacity: 0.8;
}

.dep-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.dep {
  display: flex;
  align-items: center;
  gap: 7px;
  min-height: 32px;
  padding: 4px 4px 4px 8px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  font-size: 13px;
}
.dep.resolved .dep-title {
  text-decoration: line-through;
  color: var(--muted);
}
.dep.resolved .dep-link:hover .dep-title {
  text-decoration: line-through underline;
}
.dep-status {
  display: grid;
  place-items: center;
  width: 14px;
  flex: none;
  color: var(--success-border);
}
.dep-status svg {
  width: 13px;
  height: 13px;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex: none;
}
.dep-link {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 7px;
  margin: -4px 0;
  padding: 4px 0;
  color: var(--text);
  text-decoration: none;
  border-radius: 5px;
}
.dep-link:hover .dep-title,
.dep-link:focus-visible .dep-title {
  text-decoration: underline;
  text-underline-offset: 2px;
}
.dep-link:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.dep:has(.dep-link:hover) {
  border-color: color-mix(in srgb, var(--accent) 45%, var(--border));
}

.dep-id {
  flex: none;
  font-size: 11.5px;
  font-weight: 600;
  letter-spacing: 0.03em;
  color: var(--accent);
}
.dep-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dep-remove {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  flex: none;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: none;
  color: var(--muted);
}
.dep-remove:hover:not(:disabled) {
  background: color-mix(in srgb, var(--danger) 14%, transparent);
  color: var(--danger);
}
.dep-remove svg {
  width: 9px;
  height: 9px;
}

.add-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-top: 10px;
  padding: 4px 11px;
  border: 1px dashed var(--border);
  border-radius: 999px;
  background: none;
  color: var(--muted);
  font-size: 12.5px;
}
.add-btn:hover {
  color: var(--text);
  border-color: var(--muted);
  background: var(--soft);
}
.add-btn svg {
  width: 12px;
  height: 12px;
}

.add-panel {
  margin-top: 10px;
  padding: 8px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--panel);
}
.seg {
  display: flex;
  gap: 2px;
  padding: 3px;
  background: var(--sunken);
  border: 1px solid var(--border);
  border-radius: 8px;
}
.seg button {
  flex: 1;
  padding: 4px 8px;
  border: 0;
  border-radius: 6px;
  background: none;
  color: var(--muted);
  font-size: 12.5px;
}
.seg button[aria-pressed="true"] {
  background: var(--panel);
  color: var(--text);
  box-shadow: 0 1px 2px var(--shadow-color);
}
.search {
  width: 100%;
  min-height: 32px;
  margin-top: 8px;
  padding: 5px 9px;
  background: var(--sunken);
  border: 1px solid var(--border);
  border-radius: 7px;
  color: var(--text);
  font-size: 13px;
}
.search:focus {
  outline: none;
  border-color: var(--accent);
}
.results {
  list-style: none;
  margin: 6px 0 0;
  padding: 0;
  max-height: 220px;
  overflow-y: auto;
}
.results .none {
  padding: 6px 4px;
}
.result {
  display: flex;
  align-items: center;
  gap: 7px;
  width: 100%;
  padding: 6px;
  border: 0;
  border-radius: 7px;
  background: none;
  color: var(--text);
  font-size: 13px;
  text-align: left;
}
.result:hover:not(:disabled),
.result:focus-visible {
  background: var(--soft);
  outline: none;
}
.archived {
  flex: none;
  font-size: 11px;
  color: var(--muted);
}
.add-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid var(--border);
  font-size: 11.5px;
  color: var(--muted);
}
.link {
  padding: 3px 6px;
  border: 0;
  border-radius: 6px;
  background: none;
  font-size: 12.5px;
  font-weight: 600;
}
.link.muted {
  color: var(--muted);
}
.link.muted:hover {
  background: var(--soft);
  color: var(--text);
}
</style>
