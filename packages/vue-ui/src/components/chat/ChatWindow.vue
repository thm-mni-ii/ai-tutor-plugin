<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAiTutorStore } from '../../useAiTutorStore'
import { useBackend } from '../../useBackend'
import type { NotebookData } from '../../useBackend'
import { useAutoScroll } from '../../composables/useAutoScroll'
import ChatMessage from './ChatMessage.vue'
import LoadingIndicator from './LoadingIndicator.vue'
import ScrollToBottomButton from './ScrollToBottomButton.vue'
import ChatInput from './ChatInput.vue'

const { messages, isLoading } = useAiTutorStore()
const { sendFollowUp } = useBackend()
const { t } = useI18n()

const scrollContainer = ref<HTMLElement | null>(null)
const { showScrollButton, scrollToBottom, handleScroll } = useAutoScroll(
  scrollContainer,
  () => `${messages.value.length}:${isLoading.value}`
)

// Placeholder until the real notebook (cells, file name) is wired through
// from the JupyterLab notebookTracker — out of scope for the chat UI itself.
function currentNotebookPlaceholder(): NotebookData {
  return { cells: [], fileName: 'untitled.ipynb' }
}

function handleSubmit(question: string): void {
  void sendFollowUp(question, currentNotebookPlaceholder())
}
</script>

<template>
  <div class="chat-window">
    <div class="chat-window__viewport">
      <div ref="scrollContainer" class="chat-window__messages" @scroll="handleScroll">
        <p v-if="messages.length === 0 && !isLoading" class="chat-window__empty">
          {{ t('chat.empty') }}
        </p>

        <ChatMessage v-for="(message, index) in messages" :key="index" :message="message" />

        <LoadingIndicator v-if="isLoading" />
      </div>

      <ScrollToBottomButton :visible="showScrollButton" @click="scrollToBottom()" />
    </div>

    <ChatInput :disabled="isLoading" @submit="handleSubmit" />
  </div>
</template>

<style scoped>
.chat-window {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.chat-window__viewport {
  position: relative;
  flex: 1;
  min-height: 0;
}

.chat-window__messages {
  position: absolute;
  inset: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
}

.chat-window__empty {
  margin: auto 0;
  text-align: center;
  font-size: 12px;
  color: var(--jp-ui-font-color2);
}
</style>
