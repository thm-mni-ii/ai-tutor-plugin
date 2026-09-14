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

export function useBackend(backendUrl: string, username: string) {
  const { messages, isLoading, currentCellId, streamingContent, queuePosition, selectedModel, customScopes, sessions, currentSessionId, activeScope, difficulty } = useAiTutorStore()

  function getScopeLabel(scope: string): string {
    if (scope.startsWith('custom_')) {
      const id = scope.slice(7)
      const custom = customScopes.value.find(c => c.id === id)
      return custom ? custom.label : scope
    }
    return SCOPE_LABELS[scope as FeedbackScope] || scope
  }

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

        let chunk: { error?: string; content?: string; session_id?: string }
        try {
          chunk = JSON.parse(data)
        } catch {
          // Skip malformed JSON lines — SSE streams can contain non-data lines.
          continue
        }

        if (chunk.session_id) {
          currentSessionId.value = chunk.session_id
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

  // Scope button handler: starts a fresh conversation, sends notebook data to
  // /GdDS/stream, and streams the initial feedback back token by token.
  // The Python StreamHandler builds the tutor prompt from the scope + notebook.
  async function sendScopedFeedback(scope: FeedbackScope, notebook: NotebookData): Promise<void> {
    if (isLoading.value) return

    // Scope buttons always start a new conversation.
    messages.value = [{ role: 'user', content: getScopeLabel(scope) }]
    streamingContent.value = ''
    isLoading.value = true

    const pollInterval = setInterval(() => { void fetchQueuePosition() }, 2_000)
    activeController = new AbortController()
    const timeoutId = setTimeout(() => activeController?.abort(), 120_000)

    try {
      const response = await fetch(`${backendUrl}/prompt/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: messages.value,
          notebook_text: notebook.cells,
          file_name: notebook.fileName,
          cell_id: currentCellId.value,
          state: scope,
          user_name: username,
          model: selectedModel.value,
          difficulty: difficulty.value,
          session_id: currentSessionId.value,
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
      setTimeout(() => fetchSessions(), 500)
    }
  }

  // Follow-up chat: appends the user's question to the history, then streams
  // the assistant reply. The full conversation context is sent to /GdDS/stream.
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
        headers: {
          'Content-Type': 'application/json',
        },
        // The history already includes the user message we just pushed above.
        // notebook_text/cell_id are also sent so the backend can inject the
        // current code context (see main.py _queued_stream), same as sendScopedFeedback.
        body: JSON.stringify({
          messages: messages.value,
          notebook_text: notebook.cells,
          file_name: notebook.fileName,
          cell_id: currentCellId.value,
          user_name: username,
          model: selectedModel.value,
          difficulty: difficulty.value,
          session_id: currentSessionId.value,
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
      setTimeout(() => fetchSessions(), 500)
    }
  }

  // Session Management
  async function fetchSessions(): Promise<void> {
    try {
      const res = await fetch(`${backendUrl}/sessions`)
      if (res.ok) {
        sessions.value = await res.json()
      }
    } catch (err) {
      console.error('[AI Tutor] fetchSessions failed:', err)
    }
  }

  async function loadSession(sessionId: string): Promise<void> {
    try {
      const res = await fetch(`${backendUrl}/sessions/${sessionId}`)
      if (res.ok) {
        const session = await res.json()
        messages.value = session.messages || []
        currentSessionId.value = session.id
        activeScope.value = session.scope
      }
    } catch (err) {
      console.error('[AI Tutor] loadSession failed:', err)
    }
  }

  // Ratings
  async function submitRating(messageId: string, rating: number): Promise<void> {
    if (!currentSessionId.value) return
    try {
      await fetch(`${backendUrl}/ratings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message_id: messageId, session_id: currentSessionId.value, rating })
      })
    } catch (err) {
      console.error('[AI Tutor] submitRating failed:', err)
    }
  }

  // Custom Prompts Management
  async function fetchCustomScopes(): Promise<void> {
    try {
      const res = await fetch(`${backendUrl}/custom_prompts`)
      if (res.ok) {
        customScopes.value = await res.json()
      }
    } catch (err) {
      console.error('[AI Tutor] fetchCustomScopes failed:', err)
    }
  }

  async function saveCustomScope(id: string | null, label: string, prompt: string, bypassRestrictions: boolean): Promise<void> {
    const res = await fetch(`${backendUrl}/custom_prompts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, label, prompt, bypassRestrictions })
    })
    if (!res.ok) throw new Error('Failed to save custom prompt')
    await fetchCustomScopes()
  }

  async function deleteCustomScope(id: string): Promise<void> {
    const res = await fetch(`${backendUrl}/custom_prompts/${id}`, {
      method: 'DELETE'
    })
    if (!res.ok) throw new Error('Failed to delete custom prompt')
    await fetchCustomScopes()
  }

  return {
    cancelRequest,
    sendScopedFeedback,
    sendFollowUpStream,
    fetchCustomScopes,
    saveCustomScope,
    deleteCustomScope,
    fetchSessions,
    loadSession,
    submitRating
  }
}
