<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import ChatWindow from './components/chat/ChatWindow.vue'
import QueueBadge from './components/chat/QueueBadge.vue'

const props = defineProps<{
  app: unknown
  notebookTracker: unknown
  isAdmin: boolean
  username: string
  backendUrl: string
}>()

const { t } = useI18n()
</script>

<template>
  <div class="ai-tutor-panel">
    <header class="ai-tutor-panel__header">
      <div class="ai-tutor-panel__heading">
        <span class="ai-tutor-panel__title">{{ t('chat.title') }}</span>
        <span v-if="isAdmin" class="ai-tutor-panel__admin-badge">{{ t('chat.adminMode') }}</span>
        <QueueBadge />
      </div>
    </header>

    <ChatWindow
      class="ai-tutor-panel__chat"
      :notebook-tracker="notebookTracker"
      :username="props.username"
      :backend-url="props.backendUrl"
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
</style>
