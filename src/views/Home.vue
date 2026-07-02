<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { createBoard, ApiError } from "../api";
import { setEditKey } from "../lib/editKey";
import ThemeToggle from "../components/ThemeToggle.vue";

const router = useRouter();
const title = ref("");
const prefix = ref("");
const loading = ref(false);
const error = ref("");

async function submit() {
  error.value = "";
  loading.value = true;
  try {
    const { id, editKey } = await createBoard(title.value.trim(), prefix.value.trim());
    setEditKey(id, editKey);
    router.push({ name: "board", params: { id }, query: { newKey: "1" } });
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : "Failed to create board";
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="home">
    <ThemeToggle class="theme-toggle-corner" />
    <div class="card">
      <h1>Fast Kanban</h1>
      <p class="subtitle">Create a lightweight roadmap board in seconds.</p>
      <form @submit.prevent="submit">
        <label>
          Board title
          <input v-model="title" type="text" placeholder="e.g. Website Relaunch" maxlength="255" required />
        </label>
        <label>
          Card prefix
          <input
            v-model="prefix"
            type="text"
            placeholder="e.g. PROJ"
            maxlength="16"
            style="text-transform: uppercase"
            required
          />
          <span class="hint">Cards will be numbered PREFIX-1, PREFIX-2, ...</span>
        </label>
        <p v-if="error" class="error">{{ error }}</p>
        <button class="btn" type="submit" :disabled="loading">
          {{ loading ? "Creating..." : "Create board" }}
        </button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.home {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  position: relative;
}

.theme-toggle-corner {
  position: absolute;
  top: 16px;
  right: 16px;
}

.card {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 32px;
  width: 100%;
  max-width: 420px;
}

h1 {
  margin: 0 0 4px;
}

.subtitle {
  color: var(--muted);
  margin: 0 0 24px;
}

form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-weight: 600;
  font-size: 14px;
}

input {
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 4px;
  font-weight: normal;
}

.hint {
  font-weight: normal;
  color: var(--muted);
  font-size: 12px;
}

.error {
  color: var(--danger);
  font-size: 14px;
  margin: 0;
}
</style>
