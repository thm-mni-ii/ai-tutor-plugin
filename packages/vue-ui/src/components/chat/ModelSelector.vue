<script setup lang="ts">
import { ref } from 'vue'

// Model list and backend wiring are out of scope for now — UI only,
// the backend currently always uses a single hardcoded model.
const models = [
  { value: 'qwen3-coder-30b', label: 'Qwen3 Coder 30B' },
  { value: 'qwen2.5-72b', label: 'Qwen2.5 72B' },
  { value: 'qwen2.5-coder-7b', label: 'Qwen2.5 Coder 7B' }
]

const selected = ref(models[0]!.value)
</script>

<template>
  <select v-model="selected" class="model-selector">
    <option v-for="model in models" :key="model.value" :value="model.value">
      {{ model.label }}
    </option>
  </select>
</template>

<style scoped>
.model-selector {
  appearance: none;
  max-width: 100%;
  padding: 4px 22px 4px 10px;
  border: 1px solid var(--jp-border-color2);
  border-radius: 999px;
  background:
    var(--jp-layout-color1)
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23888'/%3E%3C/svg%3E")
    no-repeat right 8px center;
  color: var(--jp-ui-font-color1);
  font-family: inherit;
  font-size: 11px;
  cursor: pointer;
}

.model-selector:focus {
  outline: none;
  border-color: var(--jp-brand-color1);
}
</style>
