<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

defineProps<{
  disabled?: boolean
}>()

const emit = defineEmits<{
  submit: [question: string]
}>()

const { t } = useI18n()
const draft = ref('')
const fileInput = ref<HTMLInputElement | null>(null)
const attachedFileName = ref<string | null>(null)

function submit(): void {
  const question = draft.value.trim()
  if (!question) return
  emit('submit', question)
  draft.value = ''
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    submit()
  }
}

function openFilePicker(): void {
  fileInput.value?.click()
}

// File attachments are UI-only for now: the backend has no upload endpoint
// yet, so the picked file isn't actually sent anywhere.
function onFileChange(event: Event): void {
  const file = (event.target as HTMLInputElement).files?.[0]
  attachedFileName.value = file ? file.name : null
}

function clearAttachment(): void {
  attachedFileName.value = null
  if (fileInput.value) fileInput.value.value = ''
}
</script>

<template>
  <div class="chat-composer">
    <div v-if="attachedFileName" class="chat-composer__attachment">
      <span class="chat-composer__attachment-name">📎 {{ attachedFileName }}</span>
      <button
        type="button"
        class="chat-composer__attachment-remove"
        :aria-label="t('chat.removeAttachment')"
        @click="clearAttachment"
      >
        ×
      </button>
    </div>

    <form class="chat-composer__row" @submit.prevent="submit">
      <button
        type="button"
        class="chat-composer__icon-button"
        :disabled="disabled"
        :aria-label="t('chat.attachFile')"
        @click="openFilePicker"
      >
        📎
      </button>
      <input ref="fileInput" type="file" class="chat-composer__file-input" @change="onFileChange" />

      <textarea
        v-model="draft"
        class="chat-composer__field"
        :placeholder="t('chat.inputPlaceholder')"
        :disabled="disabled"
        rows="1"
        @keydown="onKeydown"
      />

      <button
        type="submit"
        class="chat-composer__send"
        :disabled="disabled || !draft.trim()"
        :aria-label="t('chat.send')"
      >
        ➤
      </button>
    </form>
  </div>
</template>

<style scoped>
.chat-composer {
  flex-shrink: 0;
  padding: 10px 12px 12px;
  border-top: 1px solid var(--jp-border-color2);
}

.chat-composer__attachment {
  display: flex;
  align-items: center;
  gap: 6px;
  width: fit-content;
  margin-bottom: 6px;
  padding: 3px 8px;
  border-radius: 999px;
  background: var(--jp-layout-color2);
  font-size: 11px;
  color: var(--jp-ui-font-color2);
}

.chat-composer__attachment-remove {
  border: none;
  background: none;
  color: inherit;
  font-size: 13px;
  line-height: 1;
  cursor: pointer;
  padding: 0;
}

.chat-composer__row {
  display: flex;
  align-items: flex-end;
  gap: 4px;
  padding: 4px 4px 4px 8px;
  border: 1px solid var(--jp-border-color2);
  border-radius: 18px;
  background: var(--jp-layout-color1);
}

.chat-composer__row:has(.chat-composer__field:focus) {
  border-color: var(--jp-brand-color1);
}

.chat-composer__file-input {
  display: none;
}

.chat-composer__icon-button {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 50%;
  background: transparent;
  font-size: 14px;
  cursor: pointer;
}

.chat-composer__icon-button:hover {
  background: var(--jp-layout-color2);
}

.chat-composer__icon-button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.chat-composer__field {
  flex: 1;
  min-height: 28px;
  max-height: 96px;
  resize: none;
  border: none;
  background: transparent;
  color: var(--jp-ui-font-color1);
  font: inherit;
  font-size: var(--jp-ui-font-size1, 13px);
  padding: 4px 2px;
}

.chat-composer__field:focus {
  outline: none;
}

.chat-composer__field:disabled {
  opacity: 0.6;
}

.chat-composer__send {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 50%;
  background: var(--jp-brand-color1);
  color: #fff;
  font-size: 12px;
  cursor: pointer;
}

.chat-composer__send:disabled {
  background: var(--jp-layout-color3);
  color: var(--jp-ui-font-color2);
  cursor: not-allowed;
}
</style>
