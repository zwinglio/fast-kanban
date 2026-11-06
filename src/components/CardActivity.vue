<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { ApiError, apiErrorMessage, getCardEvents, type CardEvent } from "../api";
import { dateTime, relativeTime } from "../lib/formatTime";

const PREVIEW = 4;
const PAGE = 10;

const { t, n, locale } = useI18n();

const props = defineProps<{
  cardId: number;
}>();

const events = ref<CardEvent[]>([]);
const total = ref(0);
const hasMore = ref(false);
const loading = ref(true);
const loadingMore = ref(false);
const error = ref("");
const expanded = ref(false);

// Collapsed shows the latest few; expanding pages in more from the server.
const visible = computed(() => (expanded.value ? events.value : events.value.slice(0, PREVIEW)));
const canShowMore = computed(() => hasMore.value || (!expanded.value && events.value.length > PREVIEW));

async function loadFirst() {
  loading.value = true;
  error.value = "";
  try {
    const res = await getCardEvents(props.cardId, { limit: PREVIEW });
    events.value = res.events;
    hasMore.value = res.hasMore;
    total.value = res.total;
  } catch (e) {
    error.value = errorText(e, "activity.loadError");
  } finally {
    loading.value = false;
  }
}

async function showMore() {
  if (!expanded.value && events.value.length > PREVIEW) {
    expanded.value = true;
    return;
  }
  expanded.value = true;
  if (!hasMore.value || loadingMore.value) return;
  loadingMore.value = true;
  try {
    const last = events.value[events.value.length - 1];
    const res = await getCardEvents(props.cardId, { limit: PAGE, before: last?.id });
    events.value = [...events.value, ...res.events];
    hasMore.value = res.hasMore;
    total.value = res.total;
  } catch (e) {
    error.value = errorText(e, "activity.loadMoreError");
  } finally {
    loadingMore.value = false;
  }
}

/** Localised API error when the server sent a known code, else the generic message. */
function errorText(e: unknown, fallbackKey: string) {
  return e instanceof ApiError ? apiErrorMessage(e) : t(fallbackKey);
}

function showLess() {
  expanded.value = false;
}

// Both follow the active locale (the helpers read `locale.value` on every render).
function relative(iso: string) {
  return relativeTime(iso, locale.value);
}

function absolute(iso: string) {
  return dateTime(iso, locale.value);
}

type Part = { text: string; strong?: boolean };

// Sentences come from one message key with named params. Vue I18n returns a flat
// string, so the params that should stay bold are wrapped in private-use markers
// and split back into plain-text parts here (never rendered as HTML).
const STRONG_START = "\uE000";
const STRONG_END = "\uE001";

function sentence(key: string, params: Record<string, string> = {}, strong: string[] = [], plural?: number): Part[] {
  const values: Record<string, string> = {};
  for (const [name, value] of Object.entries(params)) {
    values[name] = strong.includes(name) ? `${STRONG_START}${value}${STRONG_END}` : value;
  }
  const text = plural === undefined ? t(key, values) : t(key, { ...values, n: plural });
  const parts: Part[] = [];
  let rest = text;
  while (rest) {
    const start = rest.indexOf(STRONG_START);
    if (start < 0) {
      parts.push({ text: rest });
      break;
    }
    if (start > 0) parts.push({ text: rest.slice(0, start) });
    const end = rest.indexOf(STRONG_END, start);
    parts.push({ text: rest.slice(start + 1, end), strong: true });
    rest = rest.slice(end + 1);
  }
  return parts;
}

// "1 point" / "2 points", with the count formatted for the active locale.
function pointsLabel(value: number) {
  return t("activity.points", { n: value, formatted: n(value, "integer") });
}

// Builds the sentence for an entry as plain parts (rendered as text, never as HTML).
function describe(e: CardEvent): Part[] {
  switch (e.type) {
    case "created":
      return sentence("activity.created", { column: e.data.column }, ["column"]);
    case "moved":
      return sentence("activity.moved", { from: e.data.from, to: e.data.to }, ["from", "to"]);
    case "title":
      return sentence("activity.renamed", { title: `“${e.data.to}”` }, ["title"]);
    case "description":
      return sentence("activity.description");
    case "priority":
      if (!e.data.to && e.data.reason === "deleted") {
        return sentence("activity.priorityDeleted", { priority: e.data.from ?? "" }, ["priority"]);
      }
      if (!e.data.to) return sentence("activity.priorityRemoved", { priority: e.data.from ?? "" }, ["priority"]);
      if (!e.data.from) return sentence("activity.prioritySet", { priority: e.data.to }, ["priority"]);
      return sentence("activity.priorityChanged", { from: e.data.from, to: e.data.to }, ["from", "to"]);
    case "tags": {
      if (e.data.reason === "deleted") {
        return sentence("activity.tagDeleted", { tags: e.data.removed.join(", ") }, ["tags"]);
      }
      const added = e.data.added.length > 0;
      const parts: Part[] = [];
      if (added) {
        parts.push(...sentence("activity.tagAdded", { tags: e.data.added.join(", ") }, ["tags"], e.data.added.length));
      }
      if (e.data.removed.length) {
        if (added) parts.push({ text: " · " });
        parts.push(
          ...sentence(
            added ? "activity.tagRemovedInline" : "activity.tagRemoved",
            { tags: e.data.removed.join(", ") },
            ["tags"],
            e.data.removed.length
          )
        );
      }
      return parts;
    }
    case "points":
      if (e.data.to === null) return sentence("activity.pointsCleared");
      if (e.data.from === null) return sentence("activity.pointsSet", { points: pointsLabel(e.data.to) }, ["points"]);
      return sentence(
        "activity.pointsChanged",
        { from: pointsLabel(e.data.from), to: pointsLabel(e.data.to) },
        ["from", "to"]
      );
    case "dependency":
      if (e.data.reason === "deleted") {
        return sentence(
          e.data.role === "blocked_by" ? "activity.dependencyBlockerDeleted" : "activity.dependencyBlockedDeleted",
          { card: e.data.card },
          ["card"]
        );
      }
      if (e.data.role === "blocked_by") {
        return sentence(
          e.data.action === "added" ? "activity.dependencyBlockedByAdded" : "activity.dependencyBlockedByRemoved",
          { card: e.data.card },
          ["card"]
        );
      }
      return sentence(
        e.data.action === "added" ? "activity.dependencyBlocksAdded" : "activity.dependencyBlocksRemoved",
        { card: e.data.card },
        ["card"]
      );
    case "comment": {
      const author = e.data.author || t("common.anonymous");
      if (e.data.action === "added") {
        return sentence("activity.commentAdded", { author, excerpt: `“${e.data.excerpt}”` }, ["author"]);
      }
      return sentence(
        e.data.action === "edited" ? "activity.commentEdited" : "activity.commentDeleted",
        { author },
        ["author"]
      );
    }
    case "archived":
      return sentence("activity.archived");
    case "restored":
      return sentence("activity.restored");
  }
}

const ICONS: Record<CardEvent["type"], string> = {
  created: "M12 5v14M5 12h14",
  moved: "M5 12h14M13 6l6 6-6 6",
  title: "M4 20h4L19 9l-4-4L4 16v4z",
  description: "M4 6h16M4 12h16M4 18h10",
  priority: "M5 21V4.5M5 4.5c2.5-1.6 5-1.6 7.5 0s5 1.6 7.5 0v9c-2.5 1.6-5 1.6-7.5 0s-5-1.6-7.5 0",
  points: "M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z",
  dependency: "M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1.5-1.5",
  comment: "M21 12a8 8 0 0 1-11.6 7.1L4 20l1.1-4.6A8 8 0 1 1 21 12z",
  tags: "M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z",
  archived: "M3 4h18v5H3zM5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9M10 13h4",
  restored: "M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5",
};

onMounted(loadFirst);
</script>

<template>
  <section class="activity" :aria-label="t('activity.ariaLabel')">
    <div class="activity-head">
      <span class="label">{{ t("activity.label") }}</span>
      <span v-if="!loading && total" class="count">{{ total }}</span>
    </div>

    <ul v-if="loading" class="timeline" aria-hidden="true">
      <li v-for="n in 3" :key="n" class="item skeleton">
        <span class="icon" />
        <span class="lines"><i /><i class="short" /></span>
      </li>
    </ul>

    <p v-else-if="error && !events.length" class="empty">
      {{ error }} <button type="button" class="link" @click="loadFirst">{{ t("common.retry") }}</button>
    </p>

    <p v-else-if="!events.length" class="empty">{{ t("activity.empty") }}</p>

    <template v-else>
      <ol class="timeline">
        <li v-for="e in visible" :key="e.id" class="item" :class="`t-${e.type}`">
          <span class="icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path :d="ICONS[e.type]" />
            </svg>
          </span>
          <div class="body">
            <p class="what">
              <template v-for="(part, i) in describe(e)" :key="i">
                <b v-if="part.strong">{{ part.text }}</b><template v-else>{{ part.text }}</template>
              </template>
            </p>
            <time class="when" :datetime="e.createdAt" :title="absolute(e.createdAt)">{{ relative(e.createdAt) }}</time>
          </div>
        </li>
      </ol>

      <p v-if="error" class="more-error">{{ error }}</p>

      <div v-if="canShowMore || expanded" class="activity-foot">
        <button v-if="canShowMore" type="button" class="link" :disabled="loadingMore" @click="showMore">
          {{ loadingMore ? t("common.loading") : t("activity.showMore") }}
        </button>
        <button v-if="expanded && events.length > 4" type="button" class="link muted" @click="showLess">
          {{ t("activity.showLess") }}
        </button>
      </div>
    </template>
  </section>
</template>

<style scoped>
.activity-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 12px;
}
.label {
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--muted);
}
.count {
  font-size: 11px;
  color: var(--muted);
  background: var(--soft);
  border-radius: 999px;
  padding: 1px 7px;
}

/* vertical timeline: icons joined by a thin rail */
.timeline {
  list-style: none;
  margin: 0;
  padding: 0;
}
.item {
  position: relative;
  display: flex;
  gap: 10px;
  padding-bottom: 12px;
}
.item:not(:last-child)::before {
  content: "";
  position: absolute;
  left: 11px;
  top: 24px;
  bottom: 2px;
  width: 1px;
  background: var(--border);
}
.icon {
  display: grid;
  place-items: center;
  width: 23px;
  height: 23px;
  flex: none;
  border-radius: 50%;
  background: var(--panel);
  border: 1px solid var(--border);
  color: var(--muted);
}
.icon svg {
  width: 11px;
  height: 11px;
}
.t-created .icon,
.t-restored .icon {
  color: var(--accent);
  border-color: color-mix(in srgb, var(--accent) 40%, var(--border));
}
.t-archived .icon {
  border-style: dashed;
}
.body {
  min-width: 0;
  padding-top: 2px;
}
.what {
  margin: 0;
  font-size: 13px;
  line-height: 1.4;
  color: var(--muted);
  overflow-wrap: anywhere;
}
.what b {
  color: var(--text);
  font-weight: 600;
}
.when {
  display: block;
  margin-top: 1px;
  font-size: 11.5px;
  color: var(--muted);
  opacity: 0.8;
}

.activity-foot {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: 27px;
}
.link {
  padding: 4px 6px;
  margin-left: -6px;
  border: 0;
  border-radius: 6px;
  background: none;
  color: var(--accent);
  font-size: 12.5px;
  font-weight: 600;
}
.link:hover:not(:disabled) {
  background: var(--accent-soft);
}
.link:disabled {
  opacity: 0.6;
  cursor: default;
}
.link.muted {
  color: var(--muted);
  margin-left: 0;
}
.link.muted:hover {
  background: var(--soft);
  color: var(--text);
}
.empty,
.more-error {
  margin: 0;
  font-size: 13px;
  color: var(--muted);
}
.more-error {
  margin: 0 0 6px 33px;
  color: var(--danger);
}

/* loading placeholder */
.skeleton .icon {
  background: var(--soft);
  border-color: transparent;
}
.skeleton .lines {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: 5px;
}
.skeleton .lines i {
  display: block;
  height: 8px;
  width: 85%;
  border-radius: 4px;
  background: var(--soft);
  animation: pulse 1.2s ease-in-out infinite;
}
.skeleton .lines i.short {
  width: 40%;
}
@keyframes pulse {
  50% { opacity: 0.45; }
}
@media (prefers-reduced-motion: reduce) {
  .skeleton .lines i { animation: none; }
}
</style>
