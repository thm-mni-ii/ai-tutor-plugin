<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAiTutorStore } from '../../useAiTutorStore'
import type { FeedbackScope } from '../../useAiTutorStore'
import { useBackend } from '../../useBackend'

import { useNotebook } from '../../composables/useNotebook'
import { useAutoScroll } from '../../composables/useAutoScroll'
import ChatMessage from './ChatMessage.vue'
import LoadingIndicator from './LoadingIndicator.vue'
import ScrollToBottomButton from './ScrollToBottomButton.vue'
import ChatInput from './ChatInput.vue'
import ScopeSelector from './ScopeSelector.vue'

const props = defineProps<{
  notebookTracker: unknown
}>()

const { messages, isLoading, streamingContent } = useAiTutorStore()
const { sendScopedFeedback, sendFollowUpStream } = useBackend()
const { getNotebookData } = useNotebook(props.notebookTracker)
const { t } = useI18n()

const scrollContainer = ref<HTMLElement | null>(null)

const { showScrollButton, scrollToBottom, handleScroll } = useAutoScroll(
  scrollContainer,
  () => `${messages.value.length}:${isLoading.value}:${streamingContent.value.length}`
)

function handleScope(scope: FeedbackScope): void {
  void sendScopedFeedback(scope, getNotebookData())
}

function handleSubmit(question: string): void {
  void sendFollowUpStream(question)
}
</script>

<template>
  <div class="chat-window">
    <ScopeSelector @select="handleScope" />

    <div class="chat-window__viewport">
      <div ref="scrollContainer" class="chat-window__messages" @scroll="handleScroll">
        <p v-if="messages.length === 0 && !isLoading && !streamingContent" class="chat-window__empty">
          {{ t('chat.empty') }}
        </p>

        <!-- Committed messages (user + fully received assistant) -->
        <ChatMessage v-for="(message, index) in messages" :key="index" :message="message" />

        <!-- Live streaming bubble: appears token-by-token while LLM is generating -->
        <ChatMessage
          v-if="streamingContent"
          :message="{ role: 'assistant', content: streamingContent }"
          :streaming="true"
        />

        <!-- Waiting indicator: shown while loading but no tokens have arrived yet
             (e.g. queuing, network latency before first token) -->
        <LoadingIndicator v-else-if="isLoading" />
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
