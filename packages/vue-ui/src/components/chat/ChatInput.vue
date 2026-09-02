<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  disabled?: boolean
}>()

const emit = defineEmits<{
  submit: [question: string]
}>()

const { t } = useI18n()
const draft = ref('')
const textarea = ref<HTMLTextAreaElement | null>(null)

function submit(): void {
  const question = draft.value.trim()
  if (!question) return
  emit('submit', question)
  draft.value = ''
}

// The field is disabled while a request is in flight (see ChatWindow.vue
// :disabled="isLoading"), which browsers blur automatically. Re-focus it the
// moment it re-enables so the next message can be typed without clicking
// back into the field.
watch(
  () => props.disabled,
  async (isDisabled, wasDisabled) => {
    if (wasDisabled && !isDisabled) {
      await nextTick()
      textarea.value?.focus()
    }
  }
)

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    submit()
  }
}

</script>

<template>
  <div class="chat-composer">
    <form class="chat-composer__row" @submit.prevent="submit">
      <textarea
        ref="textarea"
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
