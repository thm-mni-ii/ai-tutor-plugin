<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { ChatMessage } from '../../useAiTutorStore'

const props = defineProps<{
  message: ChatMessage
  // When true, a blinking cursor is appended — used while the LLM is streaming.
  streaming?: boolean
}>()

const { t } = useI18n()
</script>

<template>
  <div class="chat-message" :class="`chat-message--${props.message.role}`">
    <div class="chat-message__avatar">
      {{ props.message.role === 'user' ? t('chat.you') : 'AI' }}
    </div>
    <div class="chat-message__bubble">
      <p class="chat-message__content" :class="{ 'chat-message__content--streaming': props.streaming }">{{ props.message.content }}</p>
    </div>
  </div>
</template>

<style scoped>
.chat-message {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.chat-message--user {
  flex-direction: row-reverse;
}

.chat-message__avatar {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 9px;
  font-weight: 600;
}

.chat-message--assistant .chat-message__avatar {
  background: var(--jp-brand-color1);
  color: #fff;
}

.chat-message--user .chat-message__avatar {
  background: var(--jp-layout-color3);
  color: var(--jp-ui-font-color1);
}

.chat-message__bubble {
  min-width: 0;
  max-width: 82%;
}

.chat-message--assistant .chat-message__bubble {
  max-width: 92%;
}

.chat-message__content {
  margin: 0;
  padding: 8px 12px;
  border-radius: 14px;
  font-size: var(--jp-ui-font-size1, 13px);
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}

.chat-message--user .chat-message__content {
  background: var(--jp-brand-color1);
  color: #fff;
  border-bottom-right-radius: 4px;
}

.chat-message--assistant .chat-message__content {
  background: var(--jp-layout-color2);
  color: var(--jp-ui-font-color1);
  border-bottom-left-radius: 4px;
}

/* Blinking cursor shown while the LLM is still generating tokens. */
.chat-message__content--streaming::after {
  content: '▋';
  display: inline-block;
  margin-left: 1px;
  animation: cursor-blink 0.8s infinite;
}

@keyframes cursor-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}
</style>
