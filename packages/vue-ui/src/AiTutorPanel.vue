<script setup lang="ts">
import { useAiTutorStore } from './useAiTutorStore'

defineProps<{
  app: unknown
  notebookTracker: unknown
  isAdmin: boolean
}>()

const { messages, isLoading } = useAiTutorStore()
</script>

<template>
  <div class="ai-tutor-panel">
    <p class="placeholder-text">AI Tutor Panel</p>
    <p v-if="isAdmin" class="admin-badge">Admin mode</p>
    <p class="debug-state">messages: {{ messages.length }} | loading: {{ isLoading }}</p>
  </div>
</template>

<style scoped>
.ai-tutor-panel {
  padding: 12px;
  font-family: var(--jp-ui-font-family);
  color: var(--jp-ui-font-color1);
}

.placeholder-text {
  font-size: 14px;
  margin: 0;
}

.admin-badge {
  margin-top: 6px;
  font-size: 11px;
  color: var(--jp-warn-color1);
}

.debug-state {
  margin-top: 6px;
  font-size: 11px;
  color: var(--jp-ui-font-color2);
}
</style>
