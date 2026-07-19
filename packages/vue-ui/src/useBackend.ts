import { useAiTutorStore } from './useAiTutorStore'
import type { FeedbackScope } from './useAiTutorStore'

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

// backendUrl points at the ai-tutor-backend FastAPI service (see
// GdDS/__init__.py — injected via PageConfig from the BACKEND_URL env var).
// username identifies the student for MongoDB logging and admin checks on
// the backend; empty string outside JupyterHub (local dev).
export function useBackend(backendUrl: string, username: string) {
  const { messages, isLoading, currentCellId, streamingContent, queuePosition } = useAiTutorStore()

  // Holds the controller for the request currently in flight.
  // Replaced at the start of each new request; null when idle.
  let activeController: AbortController | null = null

  function cancelRequest(): void {
    activeController?.abort()
  }

  async function fetchQueuePosition(): Promise<void> {
    try {
      const res = await fetch(`${backendUrl}/queue`)
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
          // ai-tutor-backend re-wraps each LLM token into a flat
          // { content } chunk (see stream_request_to_server() in prompts.py)
          // rather than forwarding the raw OpenAI choices[].delta shape.
          const chunk = JSON.parse(data) as {
            error?: string
            content?: string
          }
          if (chunk.error) {
            console.error('[AI Tutor] stream error from server:', chunk.error)
            return
          }
          const token = chunk.content ?? ''
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
  // the backend's /prompt/stream, and streams the initial feedback back token
  // by token. The FastAPI endpoint builds the tutor prompt from the scope +
  // notebook data, including the matching solution file for hints.
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
      const response = await fetch(`${backendUrl}/prompt/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notebook_text: notebook.cells,
          file_name: notebook.fileName,
          cell_id: currentCellId.value,
          state: scope,
          user_name: username,
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
  // the assistant reply from the backend's /prompt/stream. Notebook data is
  // sent alongside so the backend can enrich the last message with the
  // current cell's code (see get_code_example on the backend).
  async function sendFollowUpStream(question: string, notebook: NotebookData): Promise<void> {
    if (isLoading.value) return

    // Optimistic update: show the user message immediately before the response arrives.
    messages.value = [...messages.value, { role: 'user', content: question }]
    streamingContent.value = ''
    isLoading.value = true

    const pollInterval = setInterval(() => { void fetchQueuePosition() }, 2_000)
    activeController = new AbortController()
    const timeoutId = setTimeout(() => activeController?.abort(), 120_000)

    try {
      const response = await fetch(`${backendUrl}/prompt/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // The history already includes the user message we just pushed above.
        body: JSON.stringify({
          messages: messages.value,
          notebook_text: notebook.cells,
          cell_id: currentCellId.value,
          user_name: username,
        }),
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
