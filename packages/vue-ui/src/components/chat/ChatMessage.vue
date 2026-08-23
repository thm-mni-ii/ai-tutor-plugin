<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import type { ChatMessage } from '../../useAiTutorStore'

const props = defineProps<{
  message: ChatMessage
  streaming?: boolean
}>()

const { t } = useI18n()

marked.use({ gfm: true, breaks: true })

// Completed AI messages are rendered as sanitized markdown.
// Streaming and user messages stay as plain text (text interpolation handles
// newlines correctly without needing v-html).
const renderedContent = computed(() => {
  const raw = marked.parse(props.message.content)
  return DOMPurify.sanitize(typeof raw === 'string' ? raw : props.message.content)
})
</script>

<template>
  <div class="chat-message" :class="`chat-message--${props.message.role}`">
    <div class="chat-message__avatar">
      {{ props.message.role === 'user' ? t('chat.you') : 'AI' }}
    </div>
    <div class="chat-message__bubble">
      <!-- User messages and in-flight streaming: plain text interpolation so
           white-space: pre-wrap preserves newlines without v-html overhead. -->
      <p
        v-if="props.message.role === 'user' || props.streaming"
        class="chat-message__content"
        :class="{ 'chat-message__content--streaming': props.streaming }"
      >{{ props.message.content }}</p>

      <!-- Completed AI messages: markdown rendered and sanitized. -->
      <div
        v-else
        class="chat-message__content"
        v-html="renderedContent"
      />
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
  white-space: normal;
}

/* Blinking cursor while the LLM is still generating tokens. */
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

/* ── Markdown output styles (v-html, so :deep() is required) ── */

.chat-message__content :deep(p) {
  margin: 0;
  line-height: 1.5;
}

.chat-message__content :deep(p + p) {
  margin-top: 0.5em;
}

/* Code blocks */
.chat-message__content :deep(pre) {
  background: rgba(0, 0, 0, 0.1);
  border-radius: 5px;
  padding: 8px 10px;
  overflow-x: auto;
  margin: 8px 0;
}

.chat-message--user .chat-message__content :deep(pre) {
  background: rgba(0, 0, 0, 0.2);
}

.chat-message__content :deep(pre code) {
  font-family: 'JetBrains Mono', 'Cascadia Code', 'Fira Code', Consolas, monospace;
  font-size: 0.875em;
  background: transparent;
  padding: 0;
  border-radius: 0;
}

/* Inline code */
.chat-message__content :deep(code:not(pre code)) {
  font-family: 'JetBrains Mono', 'Cascadia Code', 'Fira Code', Consolas, monospace;
  font-size: 0.875em;
  background: rgba(0, 0, 0, 0.08);
  padding: 1px 5px;
  border-radius: 3px;
}

.chat-message--user .chat-message__content :deep(code:not(pre code)) {
  background: rgba(0, 0, 0, 0.2);
}

/* Lists — allowed but rare given the system prompt */
.chat-message__content :deep(ul),
.chat-message__content :deep(ol) {
  margin: 6px 0;
  padding-left: 1.4em;
}

.chat-message__content :deep(li) {
  margin: 2px 0;
  line-height: 1.5;
}

/* Remove extra margin from first/last markdown elements */
.chat-message__content :deep(*:first-child) {
  margin-top: 0;
}

.chat-message__content :deep(*:last-child) {
  margin-bottom: 0;
}
</style>
