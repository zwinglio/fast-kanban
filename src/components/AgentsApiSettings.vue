<script setup lang="ts">
import { computed, ref } from "vue";
import { getEditKey } from "../lib/editKey";
import ModalShell from "./ModalShell.vue";

const props = defineProps<{ boardId: string }>();
const emit = defineEmits<{ close: [] }>();

const token = ref(getEditKey(props.boardId));
const showToken = ref(false);
const copied = ref<Record<string, string>>({});
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
    "FAST_KANBAN_AUTHOR=Your Name # optional",
    "node dist-mcp/fast-kanban-mcp.js",
  ].join("\n");
  const curl = (value: string) => `curl -H "Authorization: Bearer ${value}" "${restUrl}/cards"`;
  const claude = (value: string) => `claude mcp add --transport http fast-kanban ${mcpUrl} --header "Authorization: Bearer ${value}"`;
  return [
    { id: "claude", title: "Claude Code · remote", display: claude(visibleToken), copy: claude(actualToken) },
    { id: "json", title: "Generic MCP configuration · remote", display: config(visibleToken), copy: config(actualToken) },
    { id: "stdio", title: "Local stdio server", display: stdio(visibleToken), copy: stdio(actualToken) },
    { id: "curl", title: "REST API · list cards", display: curl(visibleToken), copy: curl(actualToken) },
  ];
});

async function copy(id: string, value: string) {
  try {
    await navigator.clipboard.writeText(value);
    copied.value[id] = "Copied";
  } catch {
    copied.value[id] = "Unavailable";
  }
  setTimeout(() => {
    copied.value[id] = "Copy";
  }, 1500);
}
</script>

<template>
  <ModalShell
    title="Agents & API"
    subtitle="Connect tools and agents to this board."
    :width="720"
    @close="emit('close')"
  >
    <section class="sheet-section">
      <div class="sheet-section-head"><span class="sheet-label">Board access</span></div>
      <div class="access-row">
        <span class="access-label">Board ID</span>
        <code>{{ boardId }}</code>
        <button class="btn secondary" type="button" @click="copy('board', boardId)">{{ copied.board ?? "Copy" }}</button>
      </div>
      <div class="access-row">
        <span class="access-label">Token</span>
        <template v-if="token">
          <code class="token-value">{{ showToken ? token : "••••••••••••" }}</code>
          <button class="btn secondary" type="button" @click="showToken = !showToken">{{ showToken ? "Hide" : "Show" }}</button>
          <button class="btn secondary" type="button" @click="copy('token', token)">{{ copied.token ?? "Copy" }}</button>
        </template>
        <span v-else class="access-note">This browser has no saved edit key. Enter the key on the board to enable agent access.</span>
      </div>
      <div class="access-row">
        <span class="access-label">REST base</span>
        <code>{{ restUrl }}</code>
        <button class="btn secondary" type="button" @click="copy('rest', restUrl)">{{ copied.rest ?? "Copy" }}</button>
      </div>
      <div class="access-row">
        <span class="access-label">MCP URL</span>
        <code>{{ mcpUrl }}</code>
        <button class="btn secondary" type="button" @click="copy('mcp', mcpUrl)">{{ copied.mcp ?? "Copy" }}</button>
      </div>
      <p class="access-warning" role="note">This token grants full edit access to the board. Keep it private and only share it with trusted agents.</p>
    </section>

    <section class="sheet-section">
      <div class="sheet-section-head"><span class="sheet-label">Examples</span></div>
      <div v-for="snippet in snippets" :key="snippet.id" class="agent-snippet">
        <div class="snippet-head">
          <span>{{ snippet.title }}</span>
          <button class="btn secondary" type="button" @click="copy(snippet.id, snippet.copy)">{{ copied[snippet.id] ?? "Copy" }}</button>
        </div>
        <pre><code>{{ snippet.display }}</code></pre>
      </div>
      <p class="sheet-note">Card keys look like PREFIX-123. Call <code>get_board</code> to see valid column, priority, and tag names.</p>
    </section>

    <template #footer>
      <button class="btn" type="button" @click="emit('close')">Done</button>
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
