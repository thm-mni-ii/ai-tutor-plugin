<script setup lang="ts">
import { useI18n } from 'vue-i18n'

defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  click: []
}>()

const { t } = useI18n()
</script>

<template>
  <Transition name="scroll-button-fade">
    <button
      v-if="visible"
      type="button"
      class="scroll-to-bottom"
      :aria-label="t('chat.scrollToBottom')"
      @click="emit('click')"
    >
      ↓
    </button>
  </Transition>
</template>

<style scoped>
.scroll-to-bottom {
  position: absolute;
  right: 12px;
  bottom: 12px;
  width: 28px;
  height: 28px;
  border: 1px solid var(--jp-border-color2);
  border-radius: 50%;
  background: var(--jp-layout-color1);
  color: var(--jp-ui-font-color1);
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
}

.scroll-to-bottom:hover {
  background: var(--jp-layout-color2);
}

.scroll-button-fade-enter-active,
.scroll-button-fade-leave-active {
  transition: opacity 0.15s ease;
}

.scroll-button-fade-enter-from,
.scroll-button-fade-leave-to {
  opacity: 0;
}
</style>
