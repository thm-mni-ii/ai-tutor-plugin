<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useAiTutorStore } from '../../useAiTutorStore'

const { queuePosition } = useAiTutorStore()
const { t } = useI18n()
</script>

<template>
  <!-- Only rendered when the backend reports a queue position > 0 (M7). -->
  <Transition name="queue-badge-fade">
    <div v-if="queuePosition > 0" class="queue-badge" role="status">
      {{ t('chat.queuePosition', { position: queuePosition }) }}
    </div>
  </Transition>
</template>

<style scoped>
.queue-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--jp-warn-color1);
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}

.queue-badge-fade-enter-active,
.queue-badge-fade-leave-active {
  transition: opacity 0.2s;
}

.queue-badge-fade-enter-from,
.queue-badge-fade-leave-to {
  opacity: 0;
}
</style>
