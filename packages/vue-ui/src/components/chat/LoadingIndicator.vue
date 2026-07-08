<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>

<template>
  <div class="loading-row" role="status" :aria-label="t('chat.thinking')">
    <div class="loading-row__avatar">AI</div>
    <div class="loading-row__bubble">
      <span class="loading-row__dot" />
      <span class="loading-row__dot" />
      <span class="loading-row__dot" />
    </div>
  </div>
</template>

<style scoped>
.loading-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.loading-row__avatar {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 9px;
  font-weight: 600;
  background: var(--jp-brand-color1);
  color: #fff;
}

.loading-row__bubble {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 10px 12px;
  border-radius: 14px;
  border-bottom-left-radius: 4px;
  background: var(--jp-layout-color2);
}

.loading-row__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--jp-ui-font-color2);
  animation: chat-loading-bounce 1.2s infinite ease-in-out;
}

.loading-row__dot:nth-child(2) {
  animation-delay: 0.15s;
}

.loading-row__dot:nth-child(3) {
  animation-delay: 0.3s;
}

@keyframes chat-loading-bounce {
  0%,
  80%,
  100% {
    transform: scale(0.6);
    opacity: 0.4;
  }
  40% {
    transform: scale(1);
    opacity: 1;
  }
}
</style>
