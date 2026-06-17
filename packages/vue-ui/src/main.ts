import { createApp } from 'vue'
import { i18n } from './i18n'
import AiTutorPanel from './AiTutorPanel.vue'
import { useAiTutorStore } from './useAiTutorStore'

// Pre-fill the store with realistic mock data BEFORE mounting.
// This gives Chat Interface component developers something to render and style
// without needing a running JupyterLab or backend.
const store = useAiTutorStore()
store.messages.value = [
  {
    role: 'assistant',
    content:
      'Hier ist mein Feedback zu deiner aktuellen Zelle:\n\nDeine Lösung ist gut strukturiert. Vergiss jedoch nicht, den Sonderfall zu behandeln, wenn die Liste leer ist — ohne diese Prüfung würde dein Code einen IndexError werfen.',
  },
  {
    role: 'user',
    content: 'Kannst du mir erklären, wie ich das am besten löse?',
  },
  {
    role: 'assistant',
    content:
      'Gerne! Füge am Anfang deiner Funktion eine einfache Prüfung hinzu:\n\nif not my_list:\n    return []\n\nDamit gibst du eine leere Liste zurück, bevor du versuchst, auf Elemente zuzugreifen.',
  },
]
store.isLoading.value = false

// app and notebookTracker are typed as `unknown` in AiTutorPanel,
// so null is valid here — they only matter when real JupyterLab calls are made.
const app = createApp(AiTutorPanel, {
  app: null,
  notebookTracker: null,
  isAdmin: true,
})

app.use(i18n)
app.mount('#app')
