<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { getEditKey } from "../lib/editKey";
import ModalShell from "./ModalShell.vue";

const props = defineProps<{ boardId: string }>();
const emit = defineEmits<{ close: [] }>();

const { t } = useI18n();

const token = ref(getEditKey(props.boardId));
const showToken = ref(false);
// Copy-button feedback, reset after a moment; rendered in the active locale.
const copied = ref<Record<string, "copied" | "unavailable">>({});
const origin = window.location.origin;
const restUrl = `${origin}/api/agent/boards/${props.boardId}`;
const mcpUrl = `${origin}/api/mcp/${props.boardId}`;
const placeholderToken = "<edit-key>";

const snippets = computed(() => {
  const actualToken = token.value ?? placeholderToken;
  const visibleToken = token.value && !showToken.value ? "••••••••••••" : actualToken;
  const config = (value: string) => JSON.stringify({
    mcpServers: {
      "fast-kanban": {
        url: mcpUrl,
        headers: { Authorization: `Bearer ${value}` },
      },
    },
  }, null, 2);
  const stdio = (value: string) => [
    `FAST_KANBAN_URL=${origin}`,
    `FAST_KANBAN_BOARD_ID=${props.boardId}`,
    `FAST_KANBAN_TOKEN=${value}`,
    `FAST_KANBAN_AUTHOR=${t("settings.agents.authorExample")} # ${t("common.optional")}`,
    "node dist-mcp/fast-kanban-mcp.js",
  ].join("\n");
  const curl = (value: string) => `curl -H "Authorization: Bearer ${value}" "${restUrl}/cards"`;
  const claude = (value: string) => `claude mcp add --transport http fast-kanban ${mcpUrl} --header "Authorization: Bearer ${value}"`;
  return [
    { id: "claude", titleKey: "settings.agents.snippetClaude", display: claude(visibleToken), copy: claude(actualToken) },
    { id: "json", titleKey: "settings.agents.snippetJson", display: config(visibleToken), copy: config(actualToken) },
    { id: "stdio", titleKey: "settings.agents.snippetStdio", display: stdio(visibleToken), copy: stdio(actualToken) },
    { id: "curl", titleKey: "settings.agents.snippetCurl", display: curl(visibleToken), copy: curl(actualToken) },
  ];
});

/** Localised label for a copy button, showing the last action's feedback. */
function copyLabel(id: string): string {
  const state = copied.value[id];
  if (!state) return t("common.copy");
  return state === "copied" ? t("common.copied") : t("settings.agents.unavailable");
}

async function copy(id: string, value: string) {
  try {
    await navigator.clipboard.writeText(value);
    copied.value[id] = "copied";
  } catch {
    copied.value[id] = "unavailable";
  }
  setTimeout(() => {
    delete copied.value[id];
  }, 1500);
}
</script>

<template>
  <ModalShell
    :title="t('settings.agents.title')"
    :subtitle="t('settings.agents.subtitle')"
    :width="720"
    @close="emit('close')"
  >
    <section class="sheet-section">
      <div class="sheet-section-head"><span class="sheet-label">{{ t("settings.agents.boardAccess") }}</span></div>
      <div class="access-row">
        <span class="access-label">{{ t("settings.agents.boardId") }}</span>
        <code>{{ boardId }}</code>
        <button class="btn secondary" type="button" @click="copy('board', boardId)">{{ copyLabel("board") }}</button>
      </div>
      <div class="access-row">
        <span class="access-label">{{ t("settings.agents.token") }}</span>
        <template v-if="token">
          <code class="token-value">{{ showToken ? token : "••••••••••••" }}</code>
          <button class="btn secondary" type="button" @click="showToken = !showToken">{{ showToken ? t("common.hide") : t("common.show") }}</button>
          <button class="btn secondary" type="button" @click="copy('token', token)">{{ copyLabel("token") }}</button>
        </template>
        <span v-else class="access-note">{{ t("settings.agents.noToken") }}</span>
      </div>
      <div class="access-row">
        <span class="access-label">{{ t("settings.agents.restBase") }}</span>
        <code>{{ restUrl }}</code>
        <button class="btn secondary" type="button" @click="copy('rest', restUrl)">{{ copyLabel("rest") }}</button>
      </div>
      <div class="access-row">
        <span class="access-label">{{ t("settings.agents.mcpUrl") }}</span>
        <code>{{ mcpUrl }}</code>
        <button class="btn secondary" type="button" @click="copy('mcp', mcpUrl)">{{ copyLabel("mcp") }}</button>
      </div>
      <p class="access-warning" role="note">{{ t("settings.agents.tokenWarning") }}</p>
    </section>

    <section class="sheet-section">
      <div class="sheet-section-head"><span class="sheet-label">{{ t("settings.agents.examples") }}</span></div>
      <div v-for="snippet in snippets" :key="snippet.id" class="agent-snippet">
        <div class="snippet-head">
          <span>{{ t(snippet.titleKey) }}</span>
          <button class="btn secondary" type="button" @click="copy(snippet.id, snippet.copy)">{{ copyLabel(snippet.id) }}</button>
        </div>
        <pre><code>{{ snippet.display }}</code></pre>
      </div>
      <i18n-t keypath="settings.agents.cardKeyNote" tag="p" class="sheet-note">
        <template #tool><code>get_board</code></template>
      </i18n-t>
    </section>

    <template #footer>
      <button class="btn" type="button" @click="emit('close')">{{ t("common.done") }}</button>
    </template>
  </ModalShell>
</template>

<style scoped>
.access-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 40px;
  padding: 4px 0;
}
.access-label {
  width: 82px;
  flex: none;
  color: var(--muted);
  font-size: 12px;
  font-weight: 600;
}
.access-row code {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
  font-size: 12px;
}
.access-row .btn {
  flex: none;
  padding: 6px 9px;
  font-size: 12px;
}
.token-value {
  letter-spacing: 0.08em;
}
.access-note {
  flex: 1;
  color: var(--muted);
  font-size: 12px;
}
.access-warning {
  margin: 10px 0 0;
  padding: 10px 12px;
  border: 1px solid color-mix(in srgb, var(--warning-text) 30%, transparent);
  border-radius: 8px;
  background: var(--warning-bg);
  color: var(--warning-text);
  font-size: 13px;
}
.agent-snippet + .agent-snippet {
  margin-top: 14px;
}
.snippet-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 6px;
  font-size: 13px;
  font-weight: 600;
}
.snippet-head .btn {
  padding: 6px 9px;
  font-size: 12px;
}
pre {
  margin: 0;
  padding: 10px 12px;
  overflow-x: auto;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--sunken);
  color: var(--text);
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
pre code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
@media (max-width: 520px) {
  .access-row {
    align-items: flex-start;
    flex-wrap: wrap;
  }
  .access-label {
    width: 100%;
  }
}
</style>
