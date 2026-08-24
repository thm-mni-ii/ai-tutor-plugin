import { useAiTutorStore } from './useAiTutorStore'
import type { FeedbackScope } from './useAiTutorStore'

export interface NotebookData {
  cells: unknown[]
  fileName: string
}

// Labels shown in the chat as the "user turn" when a scope button is clicked.
const SCOPE_LABELS: Record<FeedbackScope, string> = {
  cell: 'Feedback zur aktuellen Zelle',
  task: 'Hilfe zur aktuellen Aufgabe',
  sheet: 'Übersicht aller Aufgaben',
}

export function useBackend(backendUrl: string, username: string) {
  const {
    messages,
    isLoading,
    currentCellId,
    activeCellLabel,
    lockedCellId,
    streamingContent,
    queuePosition,
    selectedModel,
    conversations,
  } = useAiTutorStore()

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

        let chunk: { error?: string; content?: string }
        try {
          chunk = JSON.parse(data)
        } catch {
          // Skip malformed JSON lines — SSE streams can contain non-data lines.
          continue
        }

        if (chunk.error) {
          console.error('[AI Tutor] stream error from server:', chunk.error)
          if (streamingContent.value) {
            // Keep whatever was already generated instead of silently discarding it.
            messages.value = [
              ...messages.value,
              { role: 'assistant', content: streamingContent.value },
            ]
            streamingContent.value = ''
            return
          }
          // Nothing was generated yet — throw so the caller's catch block runs
          // and rolls back the optimistic user message (see sendScopedFeedback /
          // sendFollowUpStream). Without this, a mid-stream error left the
          // failed user turn sitting in history, and the next request would
          // send two consecutive "user" messages — which some models (e.g.
          // Gemma) reject outright with a "roles must alternate" error.
          throw new Error(chunk.error)
        }
        const token = chunk.content ?? ''
        if (token) streamingContent.value += token
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

  // Scope button handler: saves the current conversation (if non-empty) to
  // history, then starts a fresh conversation for the selected scope.
  async function sendScopedFeedback(scope: FeedbackScope, notebook: NotebookData): Promise<void> {
    if (isLoading.value) return

    // Save existing conversation before clearing — only if there's actual
    // content beyond the initial scope label (i.e. the AI replied at least once).
    if (messages.value.length > 1) {
      conversations.value = [
        {
          id: Date.now(),
          scope,
          cellLabel: activeCellLabel.value,
          lockedCellId: lockedCellId.value,
          messages: [...messages.value],
        },
        ...conversations.value,
      ].slice(0, 8) // keep at most 8 past conversations
    }

    lockedCellId.value = currentCellId.value
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
          cell_id: lockedCellId.value,
          state: scope,
          user_name: username,
          model: selectedModel.value,
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
  // the assistant reply. The full conversation context is sent to the backend.
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
        body: JSON.stringify({
          messages: messages.value,
          notebook_text: notebook.cells,
          file_name: notebook.fileName,
          cell_id: lockedCellId.value,
          user_name: username,
          model: selectedModel.value,
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
