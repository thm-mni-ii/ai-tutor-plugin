<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  isOpen: boolean
  initialId?: string | null
  initialLabel?: string
  initialPrompt?: string
  initialBypassRestrictions?: boolean
}>()

const emit = defineEmits<{
  close: []
  save: [id: string | null, label: string, prompt: string, bypassRestrictions: boolean]
}>()

const label = ref(props.initialLabel || '')
const prompt = ref(props.initialPrompt || '')
const bypassRestrictions = ref(props.initialBypassRestrictions || false)

watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    label.value = props.initialLabel || ''
    prompt.value = props.initialPrompt || ''
    bypassRestrictions.value = props.initialBypassRestrictions || false
  }
})

function save() {
  if (!label.value.trim() || !prompt.value.trim()) return
  emit('save', props.initialId ?? null, label.value.trim(), prompt.value.trim(), bypassRestrictions.value)
}
</script>

<template>
  <div v-if="isOpen" class="modal-backdrop" @click="emit('close')">
    <div class="modal-content" @click.stop>
      <h3>{{ initialId ? 'Prompt bearbeiten' : 'Neuen Prompt erstellen' }}</h3>
      
      <div class="form-group">
        <label>Button Label</label>
        <input v-model="label" type="text" placeholder="z.B. Erkläre Variablen" />
      </div>
      
      <div class="form-group">
        <label>System Prompt</label>
        <textarea v-model="prompt" rows="5" placeholder="Instruktion für die KI..."></textarea>
      </div>

      <div class="form-group checkbox-group">
        <label>
          <input v-model="bypassRestrictions" type="checkbox" />
          Standard-Einschränkungen ignorieren (erlaubt z.B. das Zeigen der Lösung)
        </label>
      </div>
      
      <div class="actions">
        <button class="btn-cancel" @click="emit('close')">Abbrechen</button>
        <button class="btn-save" :disabled="!label.trim() || !prompt.trim()" @click="save">Speichern</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: var(--jp-layout-color1, #fff);
  padding: 20px;
  border-radius: 8px;
  width: 400px;
  max-width: 90%;
  box-shadow: 0 4px 12px rgba(0,0,0,0.2);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

h3 {
  margin: 0;
  color: var(--jp-ui-font-color1);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

label {
  font-weight: bold;
  font-size: 13px;
  color: var(--jp-ui-font-color1);
}

input, textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 8px;
  border: 1px solid var(--jp-border-color2);
  border-radius: 4px;
  background: var(--jp-layout-color0, #fff);
  color: var(--jp-ui-font-color1);
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}

button {
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  border: 1px solid transparent;
}

.btn-cancel {
  background: transparent;
  border-color: var(--jp-border-color2);
  color: var(--jp-ui-font-color1);
}

.btn-save {
  background: var(--jp-brand-color1, #007bff);
  color: white;
}

.btn-save:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.checkbox-group label {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
  font-weight: normal;
  cursor: pointer;
}

.checkbox-group input {
  width: auto;
  margin: 0;
}
</style>
