<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import type { Column, Tag } from "../api";

const props = defineProps<{
  tags: Tag[];
  columns: Column[];
  tagIds: Set<number>;
  columnIds: Set<number>;
  query: string;
  cardCounts: Record<number, number>;
  shownCount: number;
  totalCount: number;
  filterActive: boolean;
}>();

const emit = defineEmits<{
  "update:tagIds": [ids: Set<number>];
  "update:columnIds": [ids: Set<number>];
  "update:query": [query: string];
}>();

const openMenu = ref<"tags" | "columns" | null>(null);
const tagQuery = ref("");
const root = ref<HTMLElement | null>(null);
const tagSearchEl = ref<HTMLInputElement | null>(null);
const searchEl = ref<HTMLInputElement | null>(null);

const selectedTags = computed(() => props.tags.filter((t) => props.tagIds.has(t.id)));
const visibleTags = computed(() => {
  const q = tagQuery.value.trim().toLowerCase();
  return q ? props.tags.filter((t) => t.name.toLowerCase().includes(q)) : props.tags;
});
const tagsActive = computed(() => props.tagIds.size > 0);
const columnsActive = computed(() => props.columnIds.size < props.columns.length);

// Short, fixed-width summary so the bar never grows with the number of tags.
const tagSummary = computed(() => {
  const names = selectedTags.value.map((t) => t.name);
  if (names.length <= 2) return names.join(", ");
  return `${names.slice(0, 2).join(", ")} +${names.length - 2}`;
});
const columnSummary = computed(() => `${props.columnIds.size} of ${props.columns.length}`);

function toggleMenu(menu: "tags" | "columns") {
  openMenu.value = openMenu.value === menu ? null : menu;
  if (openMenu.value === "tags") {
    tagQuery.value = "";
    nextTick(() => tagSearchEl.value?.focus());
  }
}

function toggleTag(id: number) {
  const next = new Set(props.tagIds);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  emit("update:tagIds", next);
}

function toggleColumn(id: number) {
  const next = new Set(props.columnIds);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  emit("update:columnIds", next);
}

function onlyColumn(id: number) {
  emit("update:columnIds", new Set([id]));
}

function clearTags() {
  emit("update:tagIds", new Set());
}

function showAllColumns() {
  emit("update:columnIds", new Set(props.columns.map((c) => c.id)));
}

function onSearchInput(e: Event) {
  emit("update:query", (e.target as HTMLInputElement).value);
}

function clearSearch() {
  emit("update:query", "");
  searchEl.value?.focus();
}

function onSearchEscape(e: KeyboardEvent) {
  e.preventDefault();
  if (props.query) emit("update:query", "");
  else searchEl.value?.blur();
}

function isTypingTarget(el: EventTarget | null) {
  if (!(el instanceof HTMLElement)) return false;
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
}

function clearAll() {
  clearTags();
  showAllColumns();
  emit("update:query", "");
  openMenu.value = null;
}

function onTagSearchEnter() {
  if (visibleTags.value.length === 1) toggleTag(visibleTags.value[0].id);
}

function onDocMousedown(e: MouseEvent) {
  if (openMenu.value && root.value && !root.value.contains(e.target as Node)) openMenu.value = null;
}

function onKeydown(e: KeyboardEvent) {
  // "/" jumps to search, unless the user is typing or a dialog is open.
  if (
    e.key === "/" &&
    !e.ctrlKey &&
    !e.metaKey &&
    !e.altKey &&
    !isTypingTarget(e.target) &&
    !document.querySelector('[aria-modal="true"]')
  ) {
    e.preventDefault();
    openMenu.value = null;
    searchEl.value?.focus();
    searchEl.value?.select();
    return;
  }
  if (e.key === "Escape" && openMenu.value) {
    e.preventDefault();
    openMenu.value = null;
  }
}

onMounted(() => {
  document.addEventListener("mousedown", onDocMousedown);
  document.addEventListener("keydown", onKeydown);
});

onBeforeUnmount(() => {
  document.removeEventListener("mousedown", onDocMousedown);
  document.removeEventListener("keydown", onKeydown);
});
</script>

<template>
  <div ref="root" class="filter-bar">
    <div class="filter-left">
      <!-- Tags -->
      <div v-if="tags.length" class="filter-pop">
        <div class="trigger" :class="{ active: tagsActive, open: openMenu === 'tags' }">
          <button
            type="button"
            class="trigger-main"
            aria-haspopup="listbox"
            :aria-expanded="openMenu === 'tags'"
            @click="toggleMenu('tags')"
          >
            <span class="trigger-label">Tags</span>
            <template v-if="tagsActive">
              <span class="trigger-sep" aria-hidden="true" />
              <span class="trigger-value">{{ tagSummary }}</span>
            </template>
            <svg v-else class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
          <button v-if="tagsActive" type="button" class="trigger-clear" aria-label="Clear tag filter" @click="clearTags">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div v-if="openMenu === 'tags'" class="menu">
          <div class="menu-search">
            <input
              ref="tagSearchEl"
              v-model="tagQuery"
              type="text"
              placeholder="Search tags…"
              aria-label="Search tags"
              @keydown.enter.prevent="onTagSearchEnter"
            />
          </div>
          <ul class="menu-list" role="listbox" aria-multiselectable="true">
            <li v-for="tag in visibleTags" :key="tag.id">
              <button
                type="button"
                class="menu-opt"
                role="option"
                :aria-selected="tagIds.has(tag.id)"
                @click="toggleTag(tag.id)"
              >
                <span class="check-box" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </span>
                <span class="opt-name">{{ tag.name }}</span>
              </button>
            </li>
            <li v-if="!visibleTags.length" class="menu-empty">No tags match “{{ tagQuery }}”.</li>
          </ul>
          <div class="menu-foot">
            <span>Cards with any selected tag</span>
            <button type="button" :disabled="!tagsActive" @click="clearTags">Clear</button>
          </div>
        </div>
      </div>

      <!-- Columns -->
      <div class="filter-pop">
        <div class="trigger" :class="{ active: columnsActive, open: openMenu === 'columns' }">
          <button
            type="button"
            class="trigger-main"
            aria-haspopup="listbox"
            :aria-expanded="openMenu === 'columns'"
            @click="toggleMenu('columns')"
          >
            <span class="trigger-label">Columns</span>
            <template v-if="columnsActive">
              <span class="trigger-sep" aria-hidden="true" />
              <span class="trigger-value">{{ columnSummary }}</span>
            </template>
            <svg v-else class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
          <button
            v-if="columnsActive"
            type="button"
            class="trigger-clear"
            aria-label="Show all columns"
            @click="showAllColumns"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div v-if="openMenu === 'columns'" class="menu">
          <ul class="menu-list" role="listbox" aria-multiselectable="true">
            <li v-for="col in columns" :key="col.id" class="menu-row">
              <button
                type="button"
                class="menu-opt"
                role="option"
                :aria-selected="columnIds.has(col.id)"
                @click="toggleColumn(col.id)"
              >
                <span class="check-box" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </span>
                <span class="dot" :style="{ background: col.color }" />
                <span class="opt-name">{{ col.name }}</span>
                <span class="opt-count">{{ cardCounts[col.id] ?? 0 }}</span>
              </button>
              <button type="button" class="only-btn" :title="`Show only ${col.name}`" @click="onlyColumn(col.id)">
                Only
              </button>
            </li>
          </ul>
          <div class="menu-foot">
            <span>Unchecked columns are hidden</span>
            <button type="button" :disabled="!columnsActive" @click="showAllColumns">Show all</button>
          </div>
        </div>
      </div>
    </div>

    <div class="filter-right">
      <span
        class="filter-count"
        :title="filterActive ? 'Drag and drop is paused while filters are on' : undefined"
      >
        <template v-if="filterActive"><b>{{ shownCount }}</b> of {{ totalCount }} cards</template>
        <template v-else>{{ totalCount }} {{ totalCount === 1 ? "card" : "cards" }}</template>
      </span>
      <button v-if="filterActive" type="button" class="clear-all" @click="clearAll">Clear filters</button>
      <div class="search" :class="{ filled: !!query }">
        <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
        <input
          ref="searchEl"
          :value="query"
          type="search"
          placeholder="Search cards…"
          aria-label="Search cards"
          autocomplete="off"
          spellcheck="false"
          @input="onSearchInput"
          @keydown.esc="onSearchEscape"
        />
        <button v-if="query" type="button" class="search-clear" aria-label="Clear search" @click="clearSearch">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        <kbd v-else class="search-kbd" aria-hidden="true">/</kbd>
      </div>
    </div>
  </div>
</template>

<style scoped>
.filter-bar {
  --soft: color-mix(in srgb, var(--text) 7%, transparent);
  --sunken: color-mix(in srgb, var(--text) 4%, var(--surface));
  --accent-soft: color-mix(in srgb, var(--accent) 14%, transparent);

  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px 16px;
  padding: 8px 10px 8px 14px;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 12px;
}

.filter-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.search {
  position: relative;
  display: flex;
  align-items: center;
  width: 240px;
  height: 32px;
  flex: none;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--sunken);
  transition: border-color 0.15s ease, width 0.2s ease;
}
.search:hover {
  border-color: color-mix(in srgb, var(--border) 50%, var(--text));
}
.search:focus-within {
  border-color: var(--accent);
  background: var(--surface);
}
.search:focus-within,
.search.filled {
  width: 300px;
}
.search.filled {
  border-color: color-mix(in srgb, var(--accent) 45%, var(--border));
}
.search-icon {
  position: absolute;
  left: 9px;
  width: 14px;
  height: 14px;
  color: var(--muted);
  pointer-events: none;
}
.search input {
  flex: 1;
  min-width: 0;
  height: 100%;
  padding: 0 8px 0 30px;
  border: 0;
  background: transparent;
  color: var(--text);
  font-size: 13px;
  outline: none;
}
.search input::placeholder {
  color: var(--muted);
}
.search input::-webkit-search-cancel-button {
  display: none;
}
.search-kbd {
  margin-right: 6px;
  padding: 0 6px;
  border: 1px solid var(--border);
  border-radius: 5px;
  font-family: inherit;
  font-size: 11px;
  line-height: 18px;
  color: var(--muted);
}
.search-clear {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  margin-right: 5px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: none;
  color: var(--muted);
}
.search-clear:hover {
  background: var(--soft);
  color: var(--text);
}
.search-clear svg {
  width: 10px;
  height: 10px;
}

.filter-pop {
  position: relative;
  min-width: 0;
}

/* trigger: one fixed-height pill per filter dimension */
.trigger {
  display: flex;
  align-items: center;
  height: 32px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  transition: border-color 0.15s ease, background 0.15s ease;
}
.trigger:hover {
  border-color: color-mix(in srgb, var(--border) 50%, var(--text));
}
.trigger.open {
  border-color: var(--accent);
}
.trigger.active {
  background: var(--accent-soft);
  border-color: color-mix(in srgb, var(--accent) 45%, var(--border));
}
.trigger-main {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 100%;
  min-width: 0;
  padding: 0 10px;
  background: none;
  border: 0;
  color: var(--text);
  font-size: 13px;
}
.trigger-label {
  font-weight: 600;
}
.trigger.active .trigger-label {
  color: var(--accent);
}
.trigger-sep {
  width: 1px;
  height: 14px;
  background: color-mix(in srgb, var(--accent) 35%, var(--border));
}
.trigger-value {
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.chev {
  width: 13px;
  height: 13px;
  color: var(--muted);
}
.trigger-clear {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  margin-right: 5px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: none;
  color: var(--accent);
}
.trigger-clear:hover {
  background: color-mix(in srgb, var(--accent) 18%, transparent);
}
.trigger-clear svg {
  width: 10px;
  height: 10px;
}

/* popover menu */
.menu {
  position: absolute;
  z-index: 40;
  top: calc(100% + 6px);
  left: 0;
  width: 260px;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: 0 18px 40px -16px var(--shadow-color), 0 2px 6px var(--shadow-color);
  overflow: hidden;
}
.menu-search {
  padding: 8px;
  border-bottom: 1px solid var(--border);
}
.menu-search input {
  width: 100%;
  min-height: 32px;
  padding: 5px 9px;
  background: var(--sunken);
  border: 1px solid var(--border);
  border-radius: 7px;
  font-size: 13px;
}
.menu-search input:focus {
  outline: none;
  border-color: var(--accent);
}
.menu-list {
  list-style: none;
  margin: 0;
  padding: 5px;
  max-height: 264px;
  overflow-y: auto;
}
.menu-row {
  position: relative;
}
.menu-opt {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  padding: 7px 9px;
  border: 0;
  border-radius: 7px;
  background: none;
  color: var(--text);
  font-size: 13.5px;
  text-align: left;
}
.menu-opt:hover,
.menu-opt:focus-visible {
  background: var(--soft);
  outline: none;
}
.check-box {
  display: grid;
  place-items: center;
  width: 16px;
  height: 16px;
  flex: none;
  border: 1.5px solid var(--border);
  border-radius: 4px;
  color: transparent;
  transition: background 0.12s ease, border-color 0.12s ease;
}
.check-box svg {
  width: 11px;
  height: 11px;
}
.menu-opt[aria-selected="true"] .check-box {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex: none;
}
.opt-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.opt-count {
  font-size: 12px;
  color: var(--muted);
}
/* "Only" replaces the count on hover */
.only-btn {
  position: absolute;
  top: 50%;
  right: 6px;
  transform: translateY(-50%);
  padding: 2px 7px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--panel);
  color: var(--muted);
  font-size: 11.5px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.12s ease;
}
.menu-row:hover .only-btn,
.only-btn:focus-visible {
  opacity: 1;
  pointer-events: auto;
}
.only-btn:hover {
  color: var(--text);
  border-color: var(--muted);
}
.menu-empty {
  padding: 10px 9px;
  font-size: 13px;
  color: var(--muted);
}
.menu-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 7px 8px 7px 12px;
  border-top: 1px solid var(--border);
  font-size: 12px;
  color: var(--muted);
}
.menu-foot button {
  padding: 4px 8px;
  border: 0;
  border-radius: 6px;
  background: none;
  color: var(--accent);
  font-size: 12.5px;
  font-weight: 600;
}
.menu-foot button:hover:not(:disabled) {
  background: var(--accent-soft);
}
.menu-foot button:disabled {
  color: var(--muted);
  opacity: 0.6;
  cursor: default;
}

/* right side */
.filter-right {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}
.filter-count {
  font-size: 13px;
  color: var(--muted);
  white-space: nowrap;
}
.filter-count b {
  color: var(--text);
  font-weight: 600;
}
.clear-all {
  padding: 6px 10px;
  border: 0;
  border-radius: 7px;
  background: none;
  color: var(--accent);
  font-size: 13px;
  font-weight: 600;
}
.clear-all:hover {
  background: var(--accent-soft);
}

@media (max-width: 640px) {
  .filter-right {
    flex-wrap: wrap;
    width: 100%;
  }
  .search {
    order: -1;
  }
  .search,
  .search:focus-within,
  .search.filled {
    width: 100%;
  }
  .search-kbd {
    display: none;
  }
}

@media (max-width: 520px) {
  .trigger-value {
    max-width: 120px;
  }
  .menu {
    width: min(260px, calc(100vw - 48px));
  }
}
</style>
