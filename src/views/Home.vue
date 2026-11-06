<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { createBoard, ApiError, apiErrorMessage } from "../api";
import { relativeTime } from "../lib/formatTime";
import { setEditKey } from "../lib/editKey";
import { forgetBoard, getRecentBoards, type RecentBoard } from "../lib/recentBoards";
import ThemeToggle from "../components/ThemeToggle.vue";
import LanguageToggle from "../components/LanguageToggle.vue";
import BoardIcon from "../components/BoardIcon.vue";

const MAX_SEQ = 999_999;
const RECENT_PREVIEW = 5;

const { t, d, n, locale } = useI18n();
const router = useRouter();
const title = ref("");
const prefix = ref("");
const continueNumbering = ref(false);
const startAt = ref<number | "">(1);
const loading = ref(false);
const error = ref("");

const recent = ref<RecentBoard[]>(getRecentBoards());
const showAllRecent = ref(false);
const visibleRecent = computed(() =>
  showAllRecent.value ? recent.value : recent.value.slice(0, RECENT_PREVIEW)
);

function removeRecent(id: string) {
  forgetBoard(id);
  recent.value = getRecentBoards();
}

function visitedLabel(ts: number) {
  const minutes = Math.round((ts - Date.now()) / 60_000);
  if (minutes > -1) return t("home.justNow");
  const hours = Math.round(minutes / 60);
  const days = Math.round(hours / 24);
  if (days > -30) return relativeTime(ts, locale.value);
  return d(new Date(ts), "medium");
}

// Keep the prefix to what the server accepts: uppercase letters and digits only.
function onPrefixInput(e: Event) {
  const el = e.target as HTMLInputElement;
  const clean = el.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 16);
  prefix.value = clean;
  if (el.value !== clean) el.value = clean;
}

const startNumber = computed(() => (continueNumbering.value && typeof startAt.value === "number" ? startAt.value : 1));
const previewPrefix = computed(() => prefix.value || "PROJ");
const startValid = computed(
  () => !continueNumbering.value || (Number.isInteger(startAt.value) && (startAt.value as number) >= 1 && (startAt.value as number) <= MAX_SEQ)
);

function toggleContinue() {
  continueNumbering.value = !continueNumbering.value;
  if (continueNumbering.value && (startAt.value === "" || startAt.value === 1)) startAt.value = 100;
}

async function submit() {
  error.value = "";
  if (!title.value.trim()) {
    error.value = t("home.errorTitle");
    return;
  }
  if (!prefix.value) {
    error.value = t("home.errorPrefix");
    return;
  }
  if (!startValid.value) {
    error.value = t("home.errorStart", { max: n(MAX_SEQ, "integer") });
    return;
  }
  loading.value = true;
  try {
    const { id, editKey } = await createBoard(
      title.value.trim(),
      prefix.value,
      continueNumbering.value ? startNumber.value : undefined,
      locale.value
    );
    setEditKey(id, editKey);
    router.push({ name: "board", params: { id }, query: { newKey: "1" } });
  } catch (e) {
    error.value = e instanceof ApiError ? apiErrorMessage(e) : t("home.createFailed");
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="home">
    <header class="home-top">
      <div class="brand">
        <span class="brand-mark"><img src="/favicon.svg" alt="" width="22" height="22" /></span>
        <span class="brand-name">Fast Kanban</span>
      </div>
      <div class="home-actions">
        <LanguageToggle />
        <ThemeToggle />
      </div>
    </header>

    <main class="home-main">
      <section class="panel create">
        <div class="panel-head">
          <h1>{{ t("home.title") }}</h1>
          <p>{{ t("home.subtitle") }}</p>
        </div>

        <form class="panel-body" novalidate @submit.prevent="submit">
          <div class="field">
            <label class="label" for="board-title">{{ t("home.boardTitle") }}</label>
            <input
              id="board-title"
              v-model="title"
              class="input"
              type="text"
              :placeholder="t('home.boardTitlePlaceholder')"
              maxlength="255"
              autofocus
            />
          </div>

          <div class="field">
            <div class="label-row">
              <label class="label" for="board-prefix">{{ t("home.cardPrefix") }}</label>
              <span class="preview" :class="{ placeholder: !prefix }" :title="t('home.prefixPreview')">
                {{ previewPrefix }}-{{ startNumber }}
              </span>
            </div>
            <input
              id="board-prefix"
              :value="prefix"
              class="input mono-caps"
              type="text"
              :placeholder="t('home.prefixPlaceholder')"
              maxlength="16"
              autocomplete="off"
              spellcheck="false"
              @input="onPrefixInput"
            />
            <p class="hint">{{ t("home.prefixHint") }}</p>
          </div>

          <div class="continue" :class="{ on: continueNumbering }">
            <button
              type="button"
              class="switch-row"
              role="switch"
              :aria-checked="continueNumbering"
              @click="toggleContinue"
            >
              <span class="switch" aria-hidden="true"><span class="knob" /></span>
              <span class="switch-text">
                <span class="switch-title">{{ t("home.continueTitle") }}</span>
                <span class="switch-hint">{{ t("home.continueHint") }}</span>
              </span>
            </button>

            <div v-if="continueNumbering" class="continue-body">
              <label class="label" for="start-at">{{ t("home.firstCardNumber") }}</label>
              <div class="start-row">
                <span class="start-prefix">{{ previewPrefix }}-</span>
                <input
                  id="start-at"
                  v-model.number="startAt"
                  class="input start-input"
                  :class="{ invalid: !startValid }"
                  type="number"
                  min="1"
                  :max="MAX_SEQ"
                  step="1"
                  inputmode="numeric"
                />
              </div>
              <i18n-t v-if="startValid" keypath="home.startHint" tag="p" class="hint" scope="global">
                <template #first>
                  <b>{{ previewPrefix }}-{{ startNumber }}</b>
                </template>
                <template #next>{{ previewPrefix }}-{{ startNumber + 1 }}</template>
              </i18n-t>
              <p v-else class="hint">
                {{ t("home.startHintInvalid", { max: n(MAX_SEQ, "integer") }) }}
              </p>
            </div>
          </div>

          <p v-if="error" class="error" role="alert">{{ error }}</p>

          <button class="btn submit" type="submit" :disabled="loading">
            {{ loading ? t("home.creating") : t("home.create") }}
          </button>
        </form>
      </section>

      <div class="side">
        <section v-if="recent.length" class="panel recent">
          <div class="panel-head recent-head">
            <h2>{{ t("home.recentBoards") }}</h2>
            <span class="count">{{ recent.length }}</span>
          </div>
          <ul class="recent-list">
            <li v-for="b in visibleRecent" :key="b.id" class="recent-row">
              <router-link :to="{ name: 'board', params: { id: b.id } }" class="recent-link">
                <BoardIcon :icon="b.icon" :title="b.title" :size="30" />
                <span class="recent-text">
                  <span class="recent-title">{{ b.title || t("home.untitledBoard") }}</span>
                  <span class="recent-meta">{{ t("home.visited", { time: visitedLabel(b.lastAccessed) }) }}</span>
                </span>
                <span v-if="!b.hasKey" class="ro-badge">{{ t("home.readOnly") }}</span>
              </router-link>
              <button
                type="button"
                class="recent-remove"
                :title="t('home.removeFromList')"
                :aria-label="t('home.removeBoard', { title: b.title || t('home.untitledBoard') })"
                @click="removeRecent(b.id)"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </li>
          </ul>
          <button
            v-if="recent.length > RECENT_PREVIEW"
            type="button"
            class="recent-more"
            @click="showAllRecent = !showAllRecent"
          >
            {{ showAllRecent ? t("home.showFewer") : t("home.showAll", { n: recent.length }) }}
          </button>
          <p class="recent-note">{{ t("home.recentNote") }}</p>
        </section>

        <aside class="panel info">
          <div class="panel-head">
            <h2>{{ t("home.benefitsTitle") }}</h2>
          </div>
          <ul class="benefits panel-body">
            <li>
              <span class="benefit-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L4 14h7l-1 8 9-12h-7z" /></svg>
              </span>
              <span><b>{{ t("home.benefit1Title") }}</b> {{ t("home.benefit1Body") }}</span>
            </li>
            <li>
              <span class="benefit-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5" /><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1.5-1.5" /></svg>
              </span>
              <span><b>{{ t("home.benefit2Title") }}</b> {{ t("home.benefit2Body") }}</span>
            </li>
            <li>
              <span class="benefit-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M4 12h10M4 17h7" /></svg>
              </span>
              <span><b>{{ t("home.benefit3Title") }}</b> {{ t("home.benefit3Body") }}</span>
            </li>
            <li>
              <span class="benefit-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
              </span>
              <span><b>{{ t("home.benefit4Title") }}</b> {{ t("home.benefit4Body") }}</span>
            </li>
          </ul>
        </aside>
      </div>
    </main>

    <footer class="credits">
      {{ t("home.footer") }}
      <a href="https://zwinglio.com" target="_blank" rel="noopener noreferrer">Samuel Zwinglio</a>
    </footer>
  </div>
</template>

<style scoped>
.home {
  --soft: color-mix(in srgb, var(--text) 7%, transparent);
  --sunken: color-mix(in srgb, var(--text) 4%, var(--surface));
  --accent-soft: color-mix(in srgb, var(--accent) 16%, transparent);

  min-height: 100vh;
  display: flex;
  flex-direction: column;
  padding: 20px 24px;
}

/* top bar */
.home-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  max-width: 940px;
  margin: 0 auto;
}
.brand {
  display: flex;
  align-items: center;
  gap: 10px;
}
.brand-mark {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--panel);
}
.brand-mark img {
  display: block;
}
.brand-name {
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.01em;
}
.home-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

/* layout */
.home-main {
  flex: 1;
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
  gap: 20px;
  align-items: start;
  width: 100%;
  max-width: 940px;
  margin: 0 auto;
  padding: 48px 0 64px;
}

.panel {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 14px;
  box-shadow: 0 24px 60px -32px var(--shadow-color);
  overflow: hidden;
}
.panel-head {
  padding: 20px 24px 16px;
  border-bottom: 1px solid var(--border);
}
.panel-head h1,
.panel-head h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  letter-spacing: -0.02em;
}
.panel-head h2 {
  font-size: 16px;
}
.panel-head p {
  margin: 4px 0 0;
  font-size: 13.5px;
  color: var(--muted);
}
.panel-body {
  padding: 22px 24px 24px;
}

/* form */
form.panel-body {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 7px;
}
.label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--muted);
}
.input {
  width: 100%;
  min-height: 40px;
  padding: 8px 12px;
  background: var(--sunken);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text);
  font-size: 14.5px;
  transition: border-color 0.15s ease, background 0.15s ease;
}
.input:hover {
  border-color: color-mix(in srgb, var(--border) 50%, var(--text));
}
.input:focus {
  outline: none;
  border-color: var(--accent);
  background: var(--surface);
}
.input::placeholder {
  color: var(--muted);
  text-transform: none;
  letter-spacing: normal;
}
.input.invalid {
  border-color: var(--danger);
}
.mono-caps {
  letter-spacing: 0.06em;
  font-weight: 600;
}
.hint {
  margin: 0;
  font-size: 12.5px;
  color: var(--muted);
}
.hint b {
  color: var(--text);
  font-weight: 600;
}

/* ID preview, same badge as the board header */
.preview {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.06em;
  color: var(--accent);
  background: var(--accent-soft);
  padding: 3px 8px;
  border-radius: 6px;
  white-space: nowrap;
}
.preview.placeholder {
  opacity: 0.55;
}

/* "continue numbering" switch */
.continue {
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  transition: border-color 0.15s ease;
}
.continue.on {
  border-color: color-mix(in srgb, var(--accent) 45%, var(--border));
}
.switch-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  width: 100%;
  padding: 12px 14px;
  background: none;
  border: 0;
  border-radius: 10px;
  color: var(--text);
  text-align: left;
}
.switch {
  position: relative;
  flex: none;
  width: 34px;
  height: 20px;
  margin-top: 1px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--text) 18%, transparent);
  transition: background 0.15s ease;
}
.knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
  transition: transform 0.15s ease;
}
.switch-row[aria-checked="true"] .switch {
  background: var(--accent);
}
.switch-row[aria-checked="true"] .knob {
  transform: translateX(14px);
}
.switch-row:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.switch-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.switch-title {
  font-size: 14px;
  font-weight: 600;
}
.switch-hint {
  font-size: 12.5px;
  color: var(--muted);
}
.continue-body {
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding: 12px 14px 14px;
  border-top: 1px solid var(--border);
}
.start-row {
  display: flex;
  align-items: center;
  max-width: 260px;
  background: var(--sunken);
  border: 1px solid var(--border);
  border-radius: 8px;
  transition: border-color 0.15s ease;
}
.start-row:focus-within {
  border-color: var(--accent);
}
.start-prefix {
  padding-left: 12px;
  font-size: 14.5px;
  font-weight: 600;
  letter-spacing: 0.06em;
  color: var(--muted);
  white-space: nowrap;
}
.start-input {
  min-width: 0;
  border: 0;
  background: transparent;
  padding-left: 2px;
  font-weight: 600;
  letter-spacing: 0.04em;
}
.start-input:focus {
  background: transparent;
}
.start-row:has(.invalid) {
  border-color: var(--danger);
}

.error {
  margin: 0;
  font-size: 13px;
  color: var(--danger);
}
.btn.submit {
  min-height: 42px;
  border-radius: 8px;
}

.side {
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-width: 0;
}

/* recent boards */
.recent-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.count {
  font-size: 11.5px;
  color: var(--muted);
  background: var(--soft);
  border-radius: 999px;
  padding: 1px 8px;
}
.recent-list {
  list-style: none;
  margin: 0;
  padding: 6px;
}
.recent-row {
  position: relative;
}
.recent-link {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 40px 8px 10px;
  border-radius: 8px;
  color: var(--text);
  text-decoration: none;
}
.recent-link:hover,
.recent-link:focus-visible {
  background: var(--soft);
  outline: none;
}
.recent-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.recent-title {
  font-size: 14px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.recent-meta {
  font-size: 12px;
  color: var(--muted);
}
.ro-badge {
  flex: none;
  padding: 1px 7px;
  border-radius: 999px;
  background: var(--warning-bg);
  color: var(--warning-text);
  font-size: 11px;
  font-weight: 600;
}
.recent-remove {
  position: absolute;
  top: 50%;
  right: 8px;
  transform: translateY(-50%);
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border: 0;
  border-radius: 7px;
  background: none;
  color: var(--muted);
  opacity: 0;
  transition: opacity 0.12s ease;
}
.recent-row:hover .recent-remove,
.recent-remove:focus-visible {
  opacity: 1;
}
.recent-remove:hover {
  background: color-mix(in srgb, var(--danger) 14%, transparent);
  color: var(--danger);
}
.recent-remove svg {
  width: 10px;
  height: 10px;
}
.recent-more {
  display: block;
  width: calc(100% - 12px);
  margin: 0 6px;
  padding: 8px;
  border: 0;
  border-radius: 8px;
  background: none;
  color: var(--accent);
  font-size: 13px;
  font-weight: 600;
}
.recent-more:hover {
  background: var(--accent-soft);
}
.recent-note {
  margin: 0;
  padding: 10px 24px 14px;
  border-top: 1px solid var(--border);
  font-size: 12px;
  color: var(--muted);
}

@media (hover: none) {
  .recent-remove {
    opacity: 1;
  }
}

/* info panel */
.benefits {
  list-style: none;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.benefits li {
  display: flex;
  gap: 12px;
  font-size: 13.5px;
  line-height: 1.5;
  color: var(--muted);
}
.benefits b {
  color: var(--text);
  font-weight: 600;
}
.benefit-icon {
  display: grid;
  place-items: center;
  flex: none;
  width: 30px;
  height: 30px;
  border-radius: 8px;
  background: var(--accent-soft);
  color: var(--accent);
}
.benefit-icon svg {
  width: 15px;
  height: 15px;
}

.credits {
  text-align: center;
  font-size: 12px;
  color: var(--muted);
}
.credits a {
  color: var(--muted);
  text-decoration: underline;
}
.credits a:hover {
  color: var(--accent);
}

@media (max-width: 760px) {
  .home {
    padding: 16px;
  }
  .home-actions {
    gap: 4px;
  }
  .home-main {
    grid-template-columns: minmax(0, 1fr);
    padding: 24px 0 40px;
  }
  .panel-head,
  .panel-body {
    padding-left: 18px;
    padding-right: 18px;
  }
}
</style>
