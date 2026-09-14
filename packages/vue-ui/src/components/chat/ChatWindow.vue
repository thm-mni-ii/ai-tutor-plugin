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
  username: string
  backendUrl: string
  isAdmin: boolean
  insertCode?: (code: string, cellId?: string | null) => void
}>()

const { messages, isLoading, streamingContent, currentSessionId } = useAiTutorStore()
const { sendScopedFeedback, sendFollowUpStream, cancelRequest, saveCustomScope, deleteCustomScope, fetchCustomScopes, fetchSessions } = useBackend(props.backendUrl, props.username)

// Fetch custom scopes on mount
import { onMounted } from 'vue'
onMounted(() => {
  void fetchCustomScopes()
  void fetchSessions()
})

const { getNotebookData } = useNotebook(props.notebookTracker)
const { t } = useI18n()

const scrollContainer = ref<HTMLElement | null>(null)

const { showScrollButton, autoScrollEnabled, scrollToBottom, handleScroll } = useAutoScroll(
  scrollContainer,
  () => `${messages.value.length}:${isLoading.value}:${streamingContent.value.length}`
)

function handleScope(scope: FeedbackScope): void {
  currentSessionId.value = null
  void sendScopedFeedback(scope, getNotebookData())
}

function handleSaveCustom(id: string | null, label: string, prompt: string, bypassRestrictions: boolean): void {
  void saveCustomScope(id, label, prompt, bypassRestrictions)
}

function handleDeleteCustom(id: string): void {
  if (confirm('Bist du sicher, dass du diesen Button löschen möchtest?')) {
    void deleteCustomScope(id)
  }
}

function handleSubmit(question: string): void {
  void sendFollowUpStream(question, getNotebookData())
}

function handleRate(rating: number, index: number): void {
  const { submitRating } = useBackend(props.backendUrl, props.username)
  void submitRating(`msg-${index}`, rating)
}

function handleInsertCode(code: string): void {
  if (props.insertCode) {
    props.insertCode(code)
  } else {
    console.warn("insertCode is not provided")
  }
}
</script>

<template>
  <div class="chat-window">
    <ScopeSelector
      :is-admin="props.isAdmin"
      @select="handleScope"
      @save-custom="handleSaveCustom"
      @delete-custom="handleDeleteCustom"
    >
      <template #controls>
        <button
          type="button"
          class="scope-selector__autoscroll-btn"
          :class="{ 'scope-selector__autoscroll-btn--off': !autoScrollEnabled }"
          :title="autoScrollEnabled ? t('chat.autoScrollOn') : t('chat.autoScrollOff')"
          @click="autoScrollEnabled = !autoScrollEnabled"
        >
          {{ autoScrollEnabled ? t('chat.autoScrollOn') : t('chat.autoScrollOff') }}
        </button>
      </template>
    </ScopeSelector>

    <div class="chat-window__viewport">
      <div ref="scrollContainer" class="chat-window__messages" @scroll="handleScroll">
        <p v-if="messages.length === 0 && !isLoading && !streamingContent" class="chat-window__empty">
          {{ t('chat.empty') }}
        </p>

        <!-- Committed messages (user + fully received assistant) -->
        <ChatMessage 
          v-for="(message, index) in messages" 
          :key="index" 
          :message="message" 
          @submit-follow-up="handleSubmit"
          @rate="(r) => handleRate(r, index)"
          @insert-code="handleInsertCode"
        />

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

    <div v-if="isLoading" class="chat-window__cancel-bar">
      <button type="button" class="chat-window__cancel-btn" @click="cancelRequest()">
        {{ t('chat.cancelRequest') }}
      </button>
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

.scope-selector__autoscroll-btn {
  padding: 2px 8px;
  font-size: var(--jp-ui-font-size0, 11px);
  border: 1px solid var(--jp-border-color2);
  border-radius: 10px;
  background: var(--jp-layout-color1);
  color: var(--jp-ui-font-color2);
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}

.scope-selector__autoscroll-btn:hover {
  background: var(--jp-layout-color2);
  color: var(--jp-ui-font-color1);
}

.scope-selector__autoscroll-btn--off {
  border-color: var(--jp-warn-color1);
  color: var(--jp-warn-color1);
}

.chat-window__cancel-bar {
  display: flex;
  justify-content: center;
  padding: 4px 12px;
  flex-shrink: 0;
}

.chat-window__cancel-btn {
  padding: 3px 10px;
  font-size: var(--jp-ui-font-size0, 11px);
  border: 1px solid var(--jp-error-color1);
  border-radius: 10px;
  background: transparent;
  color: var(--jp-error-color1);
  cursor: pointer;
  transition: background 0.15s;
}

.chat-window__cancel-btn:hover {
  background: var(--jp-error-color1);
  color: #fff;
}
</style>
