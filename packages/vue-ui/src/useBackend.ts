import { useAiTutorStore } from './useAiTutorStore'
import type { FeedbackScope } from './useAiTutorStore'

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

// Labels shown in the chat as the "user turn" when a scope button is clicked.
// Keeps the conversation history readable: the student sees what they requested.
const SCOPE_LABELS: Record<FeedbackScope, string> = {
  cell: 'Feedback zur aktuellen Zelle',
  task: 'Feedback zur aktuellen Aufgabe',
  sheet: 'Feedback zu allen Aufgaben',
}

export function useBackend() {
  const { messages, isLoading, currentCellId, streamingContent, queuePosition } = useAiTutorStore()

  // Holds the controller for the request currently in flight.
  // Replaced at the start of each new request; null when idle.
  let activeController: AbortController | null = null

  function cancelRequest(): void {
    activeController?.abort()
  }

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

  // Shared SSE reader: reads from a streaming response and accumulates tokens
  // into streamingContent, then commits the full message to messages[] on [DONE].
  // Used by both sendScopedFeedback and sendFollowUpStream.
  async function readStream(response: Response): Promise<void> {
    if (!response.body) throw new Error('Response has no body')

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const data = line.slice(6).trim()

        if (data === '[DONE]') {
          if (streamingContent.value) {
            messages.value = [
              ...messages.value,
              { role: 'assistant', content: streamingContent.value },
            ]
            streamingContent.value = ''
          }
          return
        }

        try {
          const chunk = JSON.parse(data) as {
            error?: string
            choices?: Array<{ delta?: { content?: string } }>
          }
          if (chunk.error) {
            console.error('[AI Tutor] stream error from server:', chunk.error)
            return
          }
          const token = chunk.choices?.[0]?.delta?.content ?? ''
          if (token) streamingContent.value += token
        } catch {
          // Skip malformed JSON lines — SSE streams can contain non-data lines.
        }
      }
    }

    // EOF without [DONE] — commit whatever arrived.
    if (streamingContent.value) {
      messages.value = [
        ...messages.value,
        { role: 'assistant', content: streamingContent.value },
      ]
      streamingContent.value = ''
    }
  }

  // Scope button handler: starts a fresh conversation, sends notebook data to
  // /GdDS/stream, and streams the initial feedback back token by token.
  // The Python StreamHandler builds the tutor prompt from the scope + notebook.
  async function sendScopedFeedback(scope: FeedbackScope, notebook: NotebookData): Promise<void> {
    if (isLoading.value) return

    // Scope buttons always start a new conversation.
    messages.value = [{ role: 'user', content: SCOPE_LABELS[scope] }]
    streamingContent.value = ''
    isLoading.value = true

    const pollInterval = setInterval(() => { void fetchQueuePosition() }, 2_000)
    activeController = new AbortController()
    const timeoutId = setTimeout(() => activeController?.abort(), 120_000)

    try {
      const response = await fetch(`${getExtensionBaseUrl()}GdDS/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-XSRFToken': getXsrfToken(),
        },
        body: JSON.stringify({
          notebook_text: notebook.cells,
          file_name: notebook.fileName,
          cell_id: currentCellId.value,
          state: scope,
        }),
        signal: activeController.signal,
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      await readStream(response)
    } catch (err: unknown) {
      streamingContent.value = ''
      // Remove the scope label on failure so the chat doesn't show a dangling user message.
      messages.value = []
      if (err instanceof Error && err.name !== 'AbortError') {
        console.error('[AI Tutor] sendScopedFeedback failed:', err.message)
      }
    } finally {
      clearTimeout(timeoutId)
      clearInterval(pollInterval)
      activeController = null
      queuePosition.value = 0
      isLoading.value = false
    }
  }

  // Follow-up chat: appends the user's question to the history, then streams
  // the assistant reply. The full conversation context is sent to /GdDS/stream.
  async function sendFollowUpStream(question: string): Promise<void> {
    if (isLoading.value) return

    // Optimistic update: show the user message immediately before the response arrives.
    messages.value = [...messages.value, { role: 'user', content: question }]
    streamingContent.value = ''
    isLoading.value = true

    const pollInterval = setInterval(() => { void fetchQueuePosition() }, 2_000)
    activeController = new AbortController()
    const timeoutId = setTimeout(() => activeController?.abort(), 120_000)

    try {
      const response = await fetch(`${getExtensionBaseUrl()}GdDS/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-XSRFToken': getXsrfToken(),
        },
        // The history already includes the user message we just pushed above.
        body: JSON.stringify({ messages: messages.value }),
        signal: activeController.signal,
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      await readStream(response)
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
      activeController = null
      queuePosition.value = 0
      isLoading.value = false
    }
  }

  return { sendScopedFeedback, sendFollowUpStream, cancelRequest }
}
