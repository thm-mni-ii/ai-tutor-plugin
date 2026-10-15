<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useAiTutorStore } from '../../useAiTutorStore'

const props = defineProps<{ backendUrl: string }>()

const models = ref<string[]>([])

const { selectedModel } = useAiTutorStore()

onMounted(async () => {
  try {
    const res = await fetch(`${props.backendUrl}/models`)
    if (!res.ok) return
    const data = (await res.json()) as { models?: string[]; default?: string | null }
    models.value = data.models ?? []
    if (!models.value.includes(selectedModel.value)) {
      selectedModel.value = data.default ?? ''
    }
  } catch {
    models.value = []
  }
})

const label = (id: string) => id.split('/').pop() ?? id
</script>

<template>
  <select v-if="models.length > 1" v-model="selectedModel" class="model-selector">
    <option v-for="model in models" :key="model" :value="model">
      {{ label(model) }}
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
