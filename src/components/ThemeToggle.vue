<script setup lang="ts">
import { ref } from "vue";
import { getTheme, setTheme } from "../lib/theme";

const theme = ref(getTheme());

function toggle() {
  const next = theme.value === "dark" ? "light" : "dark";
  theme.value = next;
  setTheme(next);
}
</script>

<template>
  <button
    class="theme-toggle"
    type="button"
    :aria-label="theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'"
    :title="theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'"
    @click="toggle"
  >
    <span v-if="theme === 'dark'">☀️</span>
    <span v-else>🌙</span>
  </button>
</template>

<style scoped>
.theme-toggle {
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--text);
  border-radius: 6px;
  width: 34px;
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  line-height: 1;
}

.theme-toggle:hover {
  border-color: var(--accent);
}
</style>
