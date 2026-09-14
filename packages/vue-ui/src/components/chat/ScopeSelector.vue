<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAiTutorStore } from '../../useAiTutorStore'
import type { FeedbackScope, CustomScope } from '../../useAiTutorStore'
import PromptEditorModal from './PromptEditorModal.vue'

const props = defineProps<{
  isAdmin?: boolean
}>()

const emit = defineEmits<{
  select: [scope: FeedbackScope]
  saveCustom: [id: string | null, label: string, prompt: string, bypassRestrictions: boolean]
  deleteCustom: [id: string]
}>()

const { isLoading, customScopes } = useAiTutorStore()
const { t } = useI18n()

const defaultScopes: FeedbackScope[] = ['cell', 'task', 'sheet']

const isModalOpen = ref(false)
const editingPrompt = ref<CustomScope | null>(null)

function openModal(prompt: CustomScope | null = null) {
  editingPrompt.value = prompt
  isModalOpen.value = true
}

function handleSave(id: string | null, label: string, prompt: string, bypassRestrictions: boolean) {
  emit('saveCustom', id, label, prompt, bypassRestrictions)
  isModalOpen.value = false
}
</script>

<template>
  <div class="scope-selector" role="group" :aria-label="t('scope.label')">
    <button
      v-for="scope in defaultScopes"
      :key="scope"
      type="button"
      class="scope-selector__btn"
      :disabled="isLoading"
      @click="emit('select', scope)"
    >
      {{ t(`scope.${scope}`) }}
    </button>
    
    <div v-for="custom in customScopes" :key="custom.id" class="custom-btn-wrapper">
      <button
        type="button"
        class="scope-selector__btn custom-btn"
        :disabled="isLoading"
        @click="emit('select', 'custom_' + custom.id)"
      >
        {{ custom.label }}
      </button>
      <div v-if="props.isAdmin" class="admin-controls">
        <button class="icon-btn edit-btn" @click="openModal(custom)" title="Bearbeiten">✏️</button>
        <button class="icon-btn delete-btn" @click="emit('deleteCustom', custom.id)" title="Löschen">❌</button>
      </div>
    </div>
    
    <button
      v-if="props.isAdmin"
      type="button"
      class="scope-selector__btn add-btn"
      :disabled="isLoading"
      @click="openModal(null)"
    >
      + Hinzufügen
    </button>
    
    <span class="scope-selector__end"><slot name="controls" /></span>
    
    <PromptEditorModal
      :is-open="isModalOpen"
      :initial-id="editingPrompt?.id"
      :initial-label="editingPrompt?.label"
      :initial-prompt="editingPrompt?.prompt"
      :initial-bypass-restrictions="editingPrompt?.bypassRestrictions"
      @close="isModalOpen = false"
      @save="handleSave"
    />
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
  align-items: center;
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

.custom-btn-wrapper {
  display: flex;
  align-items: center;
  gap: 4px;
}

.custom-btn {
  border-color: var(--jp-brand-color2, #4caf50);
}

.add-btn {
  border-style: dashed;
  background: transparent;
}

.admin-controls {
  display: flex;
  gap: 2px;
}

.icon-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: 10px;
  padding: 2px;
  border-radius: 4px;
  opacity: 0.6;
}

.icon-btn:hover {
  background: var(--jp-layout-color2);
  opacity: 1;
}

.scope-selector__end {
  margin-left: auto;
  display: flex;
  align-items: center;
}
</style>
