<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useAiTutorStore } from '../../useAiTutorStore'
import type { FeedbackScope } from '../../useAiTutorStore'

const emit = defineEmits<{
  select: [scope: FeedbackScope]
}>()

const { isLoading } = useAiTutorStore()
const { t } = useI18n()

const scopes: FeedbackScope[] = ['task', 'sheet']
</script>

<template>
  <div class="scope-selector" role="group" :aria-label="t('scope.label')">
    <button
      v-for="scope in scopes"
      :key="scope"
      type="button"
      class="scope-selector__btn"
      :disabled="isLoading"
      @click="emit('select', scope)"
    >
      {{ t(`scope.${scope}`) }}
    </button>
    <span class="scope-selector__end"><slot name="controls" /></span>
  </div>
</template>

<style scoped>
.scope-selector {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  padding: 10px 12px;
  border-bottom: 1px solid var(--jp-border-color2);
  flex-shrink: 0;
}

.scope-selector__btn {
  padding: 4px 10px;
  font-size: var(--jp-ui-font-size1, 12px);
  border: 1px solid var(--jp-border-color2);
  border-radius: 12px;
  background: var(--jp-layout-color1);
  color: var(--jp-ui-font-color1);
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}

.scope-selector__btn:hover:not(:disabled) {
  background: var(--jp-layout-color2);
  border-color: var(--jp-brand-color1);
  color: var(--jp-brand-color1);
}

.scope-selector__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.scope-selector__end {
  margin-left: auto;
  display: flex;
  align-items: center;
}
</style>
