<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import type { ChatMessage } from '../../useAiTutorStore'
import { useNotebook } from '../../composables/useNotebook'
import { useAiTutorStore } from '../../useAiTutorStore'

const props = defineProps<{
  message: ChatMessage
  streaming?: boolean
  messageId?: string
}>()

const emit = defineEmits<{
  submitFollowUp: [question: string]
  rate: [rating: number]
  insertCode: [code: string]
}>()

const { t } = useI18n()
const { currentCellId } = useAiTutorStore()
const containerRef = ref<HTMLElement | null>(null)

// Parse suggestions out of the content
const parsedContent = computed(() => {
  let text = props.message.content || ''
  let suggestions: string[] = []
  
  const match = text.match(/<suggestions>\s*(\[[^\]]*\])\s*<\/suggestions>/)
  if (match && match[1]) {
    try {
      suggestions = JSON.parse(match[1])
      text = text.replace(match[0], '').trim()
    } catch (e) {
      console.error('Failed to parse suggestions:', e)
    }
  }
  
  return { text, suggestions }
})

// Configure marked to add insert buttons to code blocks
const renderer = new marked.Renderer()
const originalCode = renderer.code.bind(renderer)
renderer.code = function(token: any): string {
  // Use original renderer but wrap it in our container with a button
  const original = originalCode(token)
  const lang = token.lang || ''
  const encodedText = encodeURIComponent(token.text)
  return `
    <div class="code-block-wrapper">
      <div class="code-block-header">
        <span class="code-lang">${lang}</span>
        <button class="insert-code-btn" data-code="${encodedText}">In Zelle einfügen</button>
      </div>
      ${original}
    </div>
  `
}
marked.use({ renderer })

const renderedHtml = computed(() => {
  const rawHtml = marked.parse(parsedContent.value.text) as string
  return DOMPurify.sanitize(rawHtml, { 
    ADD_ATTR: ['data-code', 'class']
  })
})

function handleContainerClick(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (target.classList.contains('insert-code-btn')) {
    const encodedCode = target.getAttribute('data-code')
    if (encodedCode) {
      const code = decodeURIComponent(encodedCode)
      insertCode(code)
    }
  }
}

function insertCode(code: string) {
  emit('insertCode', code)
}

const activeRating = ref<number | null>(null)

function handleRate(rating: number) {
  activeRating.value = rating
  emit('rate', rating)
}
</script>

<template>
  <div class="chat-message" :class="`chat-message--${props.message.role}`" ref="containerRef" @click="handleContainerClick">
    <div class="chat-message__avatar">
      {{ props.message.role === 'user' ? t('chat.you') : 'AI' }}
    </div>
    <div class="chat-message__bubble">
      <div 
        class="chat-message__content" 
        :class="{ 'chat-message__content--streaming': props.streaming }"
        v-html="renderedHtml"
      ></div>
      
      <!-- Suggestions -->
      <div v-if="parsedContent.suggestions.length > 0 && !props.streaming" class="chat-message__suggestions">
        <button 
          v-for="(sug, idx) in parsedContent.suggestions" 
          :key="idx"
          class="suggestion-btn"
          @click="emit('submitFollowUp', sug)"
        >
          {{ sug }}
        </button>
      </div>

      <!-- Ratings -->
      <div v-if="props.message.role === 'assistant' && !props.streaming" class="chat-message__ratings">
        <button @click="handleRate(1)" class="rating-btn rating-btn-up" :class="{'active': activeRating === 1}" title="Hilfreich">👍</button>
        <button @click="handleRate(-1)" class="rating-btn rating-btn-down" :class="{'active': activeRating === -1}" title="Nicht hilfreich">👎</button>
      </div>
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
  width: 100%;
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

/* Markdown Content Styles */
:deep(.chat-message__content p) {
  margin: 0 0 8px 0;
}
:deep(.chat-message__content p:last-child) {
  margin-bottom: 0;
}
:deep(.chat-message__content pre) {
  background: var(--jp-layout-color1);
  padding: 8px;
  border-radius: 4px;
  overflow-x: auto;
  margin: 8px 0;
}
:deep(.code-block-wrapper) {
  background: var(--jp-layout-color1);
  border-radius: 4px;
  overflow: hidden;
  margin: 8px 0;
}
:deep(.code-block-header) {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--jp-layout-color3);
  padding: 4px 8px;
  font-size: 11px;
}
:deep(.insert-code-btn) {
  background: var(--jp-brand-color1);
  color: white;
  border: none;
  border-radius: 3px;
  padding: 2px 6px;
  cursor: pointer;
}
:deep(.insert-code-btn:hover) {
  background: var(--jp-brand-color0);
}
:deep(.code-block-wrapper pre) {
  margin: 0;
  padding: 8px;
}

/* Suggestions & Ratings */
.chat-message__suggestions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}
.suggestion-btn {
  background: var(--jp-layout-color3);
  border: 1px solid var(--jp-border-color2);
  color: var(--jp-ui-font-color1);
  border-radius: 12px;
  padding: 4px 10px;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s;
}
.suggestion-btn:hover {
  background: var(--jp-brand-color2);
  color: white;
}

.chat-message__ratings {
  display: flex;
  gap: 8px;
  margin-top: 6px;
  justify-content: flex-end;
}
.rating-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  opacity: 0.7;
  transition: all 0.2s;
  font-size: 16px;
  padding: 4px;
}
.rating-btn-up {
  filter: drop-shadow(0 0 1px #28a745);
}
.rating-btn-up:hover, .rating-btn-up.active {
  transform: scale(1.1);
  filter: drop-shadow(0 0 6px #28a745);
  opacity: 1;
}
.rating-btn-down {
  filter: drop-shadow(0 0 1px #dc3545);
}
.rating-btn-down:hover, .rating-btn-down.active {
  transform: scale(1.1);
  filter: drop-shadow(0 0 6px #dc3545);
  opacity: 1;
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
