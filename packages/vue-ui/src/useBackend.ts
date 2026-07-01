import { useAiTutorStore } from './useAiTutorStore'
import type { ChatMessage, FeedbackScope } from './useAiTutorStore'

const AUTH_URL = 'https://feedback.mni.thm.de/gdds'

function getUsername(): string {
  return window.location.pathname.split('/')[2] ?? '' // crude but works for both JupyterLab and Jupyter Notebook URL structures; falls back to empty string if path is unexpected
}

// Derives the JupyterLab base URL so extension endpoints (/GdDS/...) work
// on both standalone JupyterLab (/) and JupyterHub (/user/<name>/).
function getExtensionBaseUrl(): string {
  const match = /^(\/user\/[^/]+\/)/.exec(window.location.pathname)
  return match ? `${window.location.origin}${match[1]}` : `${window.location.origin}/`
}

// Reads the XSRF token from the cookie so Tornado's CSRF protection accepts
// POST requests from the Vue frontend to local /GdDS/* endpoints.
function getXsrfToken(): string {
  const match = /(?:^|;\s*)_xsrf=([^;]+)/.exec(document.cookie)
  return match ? decodeURIComponent(match[1]!) : ''
}

export interface NotebookData {
  cells: unknown[]
  fileName: string
}

export function useBackend() {
  const { messages, isLoading, currentCellId, streamingContent, queuePosition } = useAiTutorStore()

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

  // Legacy non-streaming follow-up — kept for backward compatibility.
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

  // Polls the queue endpoint once and updates queuePosition.
  async function fetchQueuePosition(): Promise<void> {
    try {
      const res = await fetch(`${getExtensionBaseUrl()}GdDS/queue`)
      if (res.ok) {
        const data = (await res.json()) as { position?: number }
        queuePosition.value = data.position ?? 0
      }
    } catch {
      // Queue position is informational — silently ignore network errors.
    }
  }

  // M4: streaming follow-up via SSE proxy in the JupyterLab backend.
  // Tokens arrive token-by-token and accumulate in streamingContent until
  // [DONE], at which point the full message is committed to messages[].
  async function sendFollowUpStream(question: string, notebook: NotebookData): Promise<void> {
    if (isLoading.value) return

    // Optimistic update: show the user message in the chat immediately.
    messages.value = [...messages.value, { role: 'user', content: question }]
    streamingContent.value = ''
    isLoading.value = true

    // Poll the queue position every 2 s while the request is in-flight.
    const pollInterval = setInterval(() => { void fetchQueuePosition() }, 2_000)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 120_000)

    // The history we send already includes the user message we just pushed.
    const history = messages.value

    try {
      const response = await fetch(`${getExtensionBaseUrl()}GdDS/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-XSRFToken': getXsrfToken(),
        },
        body: JSON.stringify({ messages: history }),
        signal: controller.signal,
      })

      if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`)

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        // Decode the incoming bytes and append to the line buffer.
        buffer += decoder.decode(value, { stream: true })

        // Split on newlines; keep any incomplete trailing line in the buffer.
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).trim()

          if (data === '[DONE]') {
            // Commit the fully streamed message and clear the staging area.
            if (streamingContent.value) {
              messages.value = [
                ...messages.value,
                { role: 'assistant', content: streamingContent.value },
              ]
              streamingContent.value = ''
            }
            return
          }

          // Check for server-side errors forwarded as a JSON event.
          try {
            const chunk = JSON.parse(data) as {
              error?: string
              choices?: Array<{ delta?: { content?: string } }>
            }
            if (chunk.error) {
              console.error('[AI Tutor] stream error from server:', chunk.error)
              break
            }
            const token = chunk.choices?.[0]?.delta?.content ?? ''
            if (token) streamingContent.value += token
          } catch {
            // Skip any malformed JSON lines.
          }
        }
      }

      // Reached EOF without a [DONE] marker — still save what we have.
      if (streamingContent.value) {
        messages.value = [
          ...messages.value,
          { role: 'assistant', content: streamingContent.value },
        ]
        streamingContent.value = ''
      }
    } catch (err: unknown) {
      streamingContent.value = ''
      if (err instanceof Error && err.name !== 'AbortError') {
        console.error('[AI Tutor] sendFollowUpStream failed:', err.message)
        // Remove the optimistic user message so the chat stays consistent.
        if (messages.value.at(-1)?.role === 'user') {
          messages.value = messages.value.slice(0, -1)
        }
      }
    } finally {
      clearTimeout(timeoutId)
      clearInterval(pollInterval)
      queuePosition.value = 0
      isLoading.value = false
    }
  }

  return { sendFeedback, sendFollowUp, sendFollowUpStream }
}
