import { useAiTutorStore } from './useAiTutorStore'
import type { ChatMessage, FeedbackScope } from './useAiTutorStore'

const AUTH_URL = 'https://feedback.mni.thm.de/gdds'

function getUsername(): string {
  return window.location.pathname.split('/')[2] ?? '' // crude but works for both JupyterLab and Jupyter Notebook URL structures; falls back to empty string if path is unexpected
}

export interface NotebookData {
  cells: unknown[]
  fileName: string
}

export function useBackend() {
  const { messages, isLoading, currentCellId } = useAiTutorStore()

  // Sends the three scope-based feedback requests (cell / task / sheet).
  // Body shape: { notebook_text, file_name, user_name, state }
  async function sendFeedback(scope: FeedbackScope, notebook: NotebookData): Promise<void> {
    if (isLoading.value) return
    isLoading.value = true

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 45_000)

    try {
      const response = await fetch(`${AUTH_URL}/prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notebook_text: notebook.cells,
          file_name: notebook.fileName,
          user_name: getUsername(),
          state: scope,
        }),
        signal: controller.signal,
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const data = await response.json()
      messages.value = Array.isArray(data.messages) ? data.messages : []
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError') {
        console.error('[AI Tutor] sendFeedback failed:', err.message)
      }
    } finally {
      clearTimeout(timeoutId)
      isLoading.value = false
    }
  }

  // Sends a follow-up question against the existing message history.
  // Body shape: { notebook_text, cell_id, messages } — note: no user_name or state.
  async function sendFollowUp(question: string, notebook: NotebookData): Promise<void> {
    if (isLoading.value) return
    isLoading.value = true

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 45_000)

    const history: ChatMessage[] = [
      ...messages.value,
      { role: 'user', content: question },
    ]

    try {
      const response = await fetch(`${AUTH_URL}/prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notebook_text: notebook.cells,
          cell_id: currentCellId.value,
          messages: history,
        }),
        signal: controller.signal,
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const data = await response.json()
      messages.value = Array.isArray(data.messages) ? data.messages : []
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError') {
        console.error('[AI Tutor] sendFollowUp failed:', err.message)
      }
    } finally {
      clearTimeout(timeoutId)
      isLoading.value = false
    }
  }

  return { sendFeedback, sendFollowUp }
}
