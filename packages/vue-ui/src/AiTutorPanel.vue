<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import ChatWindow from './components/chat/ChatWindow.vue'
import ModelSelector from './components/chat/ModelSelector.vue'
import QueueBadge from './components/chat/QueueBadge.vue'

import { useAiTutorStore } from './useAiTutorStore'
import { useBackend } from './useBackend'

const props = defineProps<{
  app: unknown
  notebookTracker: unknown
  isAdmin: boolean
  username: string
  backendUrl: string
  insertCode?: (code: string, cellId?: string | null) => void
}>()

const { t } = useI18n()
const { difficulty, sessions, currentSessionId, messages } = useAiTutorStore()
const { loadSession } = useBackend(props.backendUrl, props.username)

function handleSessionChange(sessionId: string) {
  if (!sessionId) {
    currentSessionId.value = null
    messages.value = []
  } else {
    void loadSession(sessionId)
  }
}
</script>

<template>
  <div class="ai-tutor-panel">
    <header class="ai-tutor-panel__header">
      <div class="ai-tutor-panel__heading">
        <span class="ai-tutor-panel__title">{{ t('chat.title') }}</span>
        <span v-if="isAdmin" class="ai-tutor-panel__admin-badge">{{ t('chat.adminMode') }}</span>
        <QueueBadge />
      </div>
      <div class="ai-tutor-panel__controls">
        <select v-model="difficulty" class="ai-tutor-panel__select" title="Tutor Difficulty">
          <option value="normal">Normal</option>
          <option value="patient">Geduldig</option>
          <option value="strict">Strikt</option>
        </select>
        <select :value="currentSessionId || ''" @change="e => handleSessionChange((e.target as HTMLSelectElement).value)" class="ai-tutor-panel__select" title="Chat Historie">
          <option value="">Neu...</option>
          <option v-for="s in sessions" :key="s.id" :value="s.id">{{ new Date(s.updated_at * 1000).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute:'2-digit' }) }} - {{ s.title }}</option>
        </select>
        <ModelSelector />
      </div>
    </header>

    <ChatWindow
      class="ai-tutor-panel__chat"
      :notebook-tracker="notebookTracker"
      :username="props.username"
      :backend-url="props.backendUrl"
      :is-admin="props.isAdmin"
      :insert-code="props.insertCode"
    />
  </div>
</template>

<style scoped>
.ai-tutor-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  font-family: var(--jp-ui-font-family);
  color: var(--jp-ui-font-color1);
}

.ai-tutor-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  gap: 8px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--jp-border-color2);
}

.ai-tutor-panel__heading {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}

.ai-tutor-panel__title {
  font-size: 14px;
  font-weight: 600;
}

.ai-tutor-panel__admin-badge {
  font-size: 11px;
  color: var(--jp-warn-color1);
}

.ai-tutor-panel__chat {
  flex: 1;
  min-height: 0;
}
.ai-tutor-panel__controls {
  display: flex;
  align-items: center;
  gap: 6px;
}

.ai-tutor-panel__select {
  padding: 2px 4px;
  font-size: var(--jp-ui-font-size0, 11px);
  border: 1px solid var(--jp-border-color2);
  border-radius: 3px;
  background: var(--jp-layout-color1);
  color: var(--jp-ui-font-color1);
  cursor: pointer;
}
</style>
