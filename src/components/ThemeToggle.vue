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
    class="icon-btn"
    type="button"
    :aria-label="theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'"
    :title="theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'"
    @click="toggle"
  >
    <span v-if="theme === 'dark'">☀️</span>
    <span v-else>🌙</span>
  </button>
</template>

