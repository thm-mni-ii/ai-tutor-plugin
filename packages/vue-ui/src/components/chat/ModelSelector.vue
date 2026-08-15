<script setup lang="ts">
import { useAiTutorStore } from '../../useAiTutorStore'

// Real model identifiers as served by the THM LLM gateway (ki6.mni.thm.de).
// Sent as `model` on /prompt/stream; see useBackend.ts.
const models = [
  { value: 'unsloth/Qwen3-Coder-30B-A3B-Instruct-GGUF/Qwen3-Coder-30B-A3B-Instruct-Q8_0.gguf', label: 'Qwen3 Coder 30B' },
  // Gemma 3 27B — disabled for now: its server-side chat template rejects our
  // requests with "Conversation roles must alternate user/assistant/..." even
  // for a single user-only turn — looks like a gateway-side template issue,
  // unrelated to what we send. Re-add once that's sorted out on the THM side.
  // { value: 'unsloth/gemma-3-27b-it-GGUF/gemma-3-27b-it-Q8_0.gguf', label: 'Gemma 3 27B' },
]

const { selectedModel } = useAiTutorStore()
</script>

<template>
  <select v-model="selectedModel" class="model-selector">
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
