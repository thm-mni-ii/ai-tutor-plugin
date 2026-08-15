import { ref } from 'vue'

export type MessageRole = 'user' | 'assistant'

export interface ChatMessage {
  role: MessageRole
  content: string
}

export type FeedbackScope = 'cell' | 'task' | 'sheet'

// Declared at module scope — every caller of useAiTutorStore() shares
// the same reactive references, including code outside Vue components.
const messages = ref<ChatMessage[]>([])
const isLoading = ref(false)
const activeScope = ref<FeedbackScope | null>(null)
const currentCellId = ref<string | null>(null)

// M4: accumulates LLM tokens as they stream in; cleared when the full
// message is committed to `messages`.
const streamingContent = ref<string>('')

// M4: position in the backend request queue (0 = no wait).
// Updated by polling the ai-tutor-backend's /queue while a request is in-flight.
const queuePosition = ref<number>(0)

// Selected LLM model, sent as `model` on every /prompt/stream request.
// Falls back to the backend's LLM_MODEL env default when empty.
const selectedModel = ref<string>('unsloth/Qwen3-Coder-30B-A3B-Instruct-GGUF/Qwen3-Coder-30B-A3B-Instruct-Q8_0.gguf')

export function useAiTutorStore() {
  return { messages, isLoading, activeScope, currentCellId, streamingContent, queuePosition, selectedModel }
}
