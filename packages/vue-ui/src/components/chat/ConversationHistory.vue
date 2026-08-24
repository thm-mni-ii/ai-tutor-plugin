<script setup lang="ts">
import { ref } from 'vue'
import { useAiTutorStore } from '../../useAiTutorStore'
import type { FeedbackScope, ConversationSnapshot } from '../../useAiTutorStore'

const { messages, conversations, lockedCellId, streamingContent } = useAiTutorStore()

const expanded = ref(true)

const SCOPE_NAMES: Record<FeedbackScope, string> = {
  cell: 'Zelle',
  task: 'Aufgabe',
  sheet: 'Blatt',
}

function restore(snap: ConversationSnapshot): void {
  messages.value = [...snap.messages]
  lockedCellId.value = snap.lockedCellId
  streamingContent.value = ''
}

function remove(id: number, event: Event): void {
  event.stopPropagation()
  conversations.value = conversations.value.filter(c => c.id !== id)
}

function clearAll(): void {
  conversations.value = []
}

function aiMessageCount(snap: ConversationSnapshot): number {
  return snap.messages.filter(m => m.role === 'assistant').length
}
</script>

<template>
  <div v-if="conversations.length > 0" class="conv-history">
    <button class="conv-history__header" @click="expanded = !expanded">
      <span>Frühere Gespräche ({{ conversations.length }})</span>
      <span class="conv-history__chevron" :class="{ 'conv-history__chevron--open': expanded }">›</span>
    </button>

    <div v-if="expanded" class="conv-history__list">
      <button
        v-for="snap in conversations"
        :key="snap.id"
        class="conv-history__item"
        @click="restore(snap)"
      >
        <span class="conv-history__scope">{{ SCOPE_NAMES[snap.scope] }}</span>
        <span v-if="snap.cellLabel" class="conv-history__cell">{{ snap.cellLabel }}</span>
        <span class="conv-history__count">{{ aiMessageCount(snap) }}</span>
        <span class="conv-history__delete" @click="remove(snap.id, $event)" title="Entfernen">×</span>
      </button>

      <button class="conv-history__clear" @click="clearAll">Alle löschen</button>
    </div>
  </div>
</template>

<style scoped>
.conv-history {
  border-bottom: 1px solid var(--jp-border-color2);
  flex-shrink: 0;
}

.conv-history__header {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 10px;
  font-size: var(--jp-ui-font-size0, 11px);
  color: var(--jp-ui-font-color2);
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;
}

.conv-history__header:hover {
  color: var(--jp-ui-font-color1);
}

.conv-history__chevron {
  display: inline-block;
  font-size: 14px;
  line-height: 1;
  transition: transform 0.15s;
}

.conv-history__chevron--open {
  transform: rotate(90deg);
}

.conv-history__list {
  max-height: 130px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  padding-bottom: 2px;
}

.conv-history__item {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  font-size: var(--jp-ui-font-size0, 11px);
  background: none;
  border: none;
  cursor: pointer;
  color: var(--jp-ui-font-color1);
  text-align: left;
  width: 100%;
  overflow: hidden;
}

.conv-history__item:hover {
  background: var(--jp-layout-color2);
}

.conv-history__scope {
  flex-shrink: 0;
  font-weight: 600;
  color: var(--jp-brand-color1);
}

.conv-history__cell {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--jp-ui-font-color2);
}

.conv-history__count {
  flex-shrink: 0;
  font-size: var(--jp-ui-font-size0, 10px);
  color: var(--jp-ui-font-color3);
  background: var(--jp-layout-color3);
  border-radius: 8px;
  padding: 0 5px;
  min-width: 16px;
  text-align: center;
}

.conv-history__delete {
  flex-shrink: 0;
  color: var(--jp-ui-font-color3);
  font-size: 14px;
  line-height: 1;
  padding: 0 2px;
  cursor: pointer;
}

.conv-history__delete:hover {
  color: var(--jp-error-color1);
}

.conv-history__clear {
  margin: 2px 10px 4px;
  background: none;
  border: none;
  font-size: var(--jp-ui-font-size0, 11px);
  color: var(--jp-ui-font-color3);
  cursor: pointer;
  text-decoration: underline;
  text-align: left;
  padding: 0;
}

.conv-history__clear:hover {
  color: var(--jp-error-color1);
}
</style>
