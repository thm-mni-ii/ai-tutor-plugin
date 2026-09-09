<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { SentContext } from '../../useAiTutorStore'

const props = defineProps<{
  context: SentContext
}>()

const { t } = useI18n()

const cellCount = computed(() => props.context.cells.length)
const errorCount = computed(() => props.context.cells.filter((cell) => cell.error).length)

// What a reader actually wants to see: the cell the question is about, plus
// any other cell that genuinely changed. On a first message every cell in
// the exercise reads as "new" (nothing to diff against yet) — without this,
// that would still dump the whole exercise here instead of just the one
// cell the student is asking about.
const activeCell = computed(
  () => props.context.cells.find((cell) => cell.id === props.context.cell_id) ?? null
)
const otherChangedCells = computed(() =>
  props.context.cells.filter((cell) => cell.id !== props.context.cell_id && cell.status === 'changed')
)
const highlightedCells = computed(() => [
  ...(activeCell.value ? [activeCell.value] : []),
  ...otherChangedCells.value,
])
const hiddenCount = computed(() => cellCount.value - highlightedCells.value.length)
</script>

<template>
  <details class="context-disclosure">
    <summary class="context-disclosure__summary">
      {{ t('context.title') }} · {{ t('context.cells', { count: cellCount }) }} · {{ t('context.errors', { count: errorCount }) }}
    </summary>

    <div class="context-disclosure__body">
      <p v-if="context.has_reference_solution" class="context-disclosure__solution-note">
        {{ t('context.solutionIncluded') }}
      </p>

      <p v-if="hiddenCount > 0" class="context-disclosure__unchanged-summary">
        {{ t('context.unchangedSummary', { count: hiddenCount }) }}
      </p>

      <div v-for="(cell, index) in highlightedCells" :key="cell.id ?? index" class="context-disclosure__cell">
        <div class="context-disclosure__cell-header">
          <span class="context-disclosure__cell-type">{{ cell.cell_type }}</span>
          <span class="context-disclosure__cell-status">{{ t(`context.${cell.status}`) }}</span>
        </div>

        <pre class="context-disclosure__code">{{ cell.source }}</pre>

        <div v-if="cell.outputs && cell.outputs.length" class="context-disclosure__section">
          <div class="context-disclosure__section-title">{{ t('context.outputs') }}</div>
          <pre
            v-for="(output, outputIndex) in cell.outputs"
            :key="outputIndex"
            class="context-disclosure__output"
          >{{ output.text }}</pre>
        </div>

        <div v-if="cell.error" class="context-disclosure__section context-disclosure__section--error">
          <div class="context-disclosure__section-title">{{ t('context.errors', { count: 1 }) }}</div>
          <pre class="context-disclosure__error">{{ cell.error.ename }}: {{ cell.error.evalue }}
{{ cell.error.traceback_head }}</pre>
        </div>
      </div>
    </div>
  </details>
</template>

<style scoped>
.context-disclosure {
  font-size: var(--jp-ui-font-size0, 11px);
  color: var(--jp-ui-font-color2);
  max-width: 100%;
}

.context-disclosure__summary {
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 8px;
  background: var(--jp-layout-color2);
  list-style: none;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.context-disclosure__summary::-webkit-details-marker {
  display: none;
}

.context-disclosure__summary::before {
  content: '▸ ';
}

.context-disclosure[open] > .context-disclosure__summary::before {
  content: '▾ ';
}

.context-disclosure__body {
  margin-top: 4px;
  max-height: 260px;
  overflow-y: auto;
  border: 1px solid var(--jp-border-color2);
  border-radius: 8px;
  padding: 6px 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.context-disclosure__solution-note,
.context-disclosure__unchanged-summary {
  margin: 0;
  font-style: italic;
}

.context-disclosure__cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.context-disclosure__cell-header {
  display: flex;
  justify-content: space-between;
  gap: 6px;
  font-weight: 600;
}

.context-disclosure__cell-status {
  font-weight: 400;
  color: var(--jp-ui-font-color3);
}

.context-disclosure__code,
.context-disclosure__output,
.context-disclosure__error {
  margin: 0;
  padding: 4px 6px;
  border-radius: 6px;
  font-family: 'JetBrains Mono', 'Cascadia Code', 'Fira Code', Consolas, monospace;
  font-size: 0.95em;
  white-space: pre-wrap;
  word-break: break-word;
  overflow-x: auto;
}

.context-disclosure__code,
.context-disclosure__output {
  background: var(--jp-layout-color1);
}

.context-disclosure__section-title {
  font-weight: 600;
  margin-bottom: 2px;
}

.context-disclosure__section--error .context-disclosure__section-title {
  color: var(--jp-error-color1);
}

.context-disclosure__error {
  background: var(--jp-layout-color1);
  color: var(--jp-error-color1);
}
</style>
