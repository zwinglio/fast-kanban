<script setup lang="ts">
import { ref } from "vue";
import { updateBoard, ApiError, type Board } from "../api";

const props = defineProps<{
  boardId: string;
  title: string;
  prefix: string;
}>();

const emit = defineEmits<{
  close: [];
  saved: [board: Board];
}>();

const title = ref(props.title);
const saving = ref(false);
const error = ref("");

async function save() {
  const trimmed = title.value.trim();
  if (!trimmed || trimmed.length > 255) {
    error.value = "Title is required (max 255 chars)";
    return;
  }
  if (trimmed === props.title) {
    emit("close");
    return;
  }
  saving.value = true;
  error.value = "";
  try {
    const updated = await updateBoard(props.boardId, { title: trimmed });
    emit("saved", updated);
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : "Failed to save board";
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="overlay" @click.self="emit('close')">
    <div class="modal">
      <div class="modal-header">
        <span class="modal-title">General</span>
        <button class="close-btn" @click="emit('close')">&times;</button>
      </div>

      <div class="modal-body">
        <div class="settings-section">
          <h3 class="section-header">Title</h3>
          <input
            v-model="title"
            type="text"
            maxlength="255"
            class="title-input"
            placeholder="Board title"
            @keyup.enter="save"
          />
        </div>

        <div class="settings-section">
          <h3 class="section-header">Prefix</h3>
          <div class="prefix-row">
            <span class="prefix-badge">{{ prefix }}</span>
            <span class="prefix-note">Used in card IDs; cannot be changed.</span>
          </div>
        </div>

        <p v-if="error" class="error">{{ error }}</p>
      </div>

      <div class="modal-footer">
        <div class="spacer" />
        <button class="btn secondary" @click="emit('close')">Cancel</button>
        <button class="btn" :disabled="saving" @click="save">
          {{ saving ? "Saving..." : "Save" }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: var(--overlay-bg);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 48px 16px;
  z-index: 100;
}

.modal {
  background: var(--panel);
  border-radius: 8px;
  width: 100%;
  max-width: 440px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
}

.modal-title {
  font-weight: 700;
  font-size: 16px;
}

.close-btn {
  background: none;
  border: none;
  font-size: 22px;
  line-height: 1;
  color: var(--muted);
}

.modal-body {
  padding: 20px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.settings-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-header {
  margin: 0;
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--muted);
}

.title-input {
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 4px;
  font-size: 14px;
}

.prefix-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.prefix-badge {
  background: var(--badge-bg);
  border-radius: 4px;
  padding: 2px 8px;
  font-size: 12px;
  font-weight: 700;
  color: var(--muted);
}

.prefix-note {
  font-size: 12px;
  color: var(--muted);
}

.error {
  color: var(--danger);
  font-size: 13px;
  margin: 0;
}

.modal-footer {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px 20px;
  border-top: 1px solid var(--border);
}

.spacer {
  flex: 1;
}
</style>
