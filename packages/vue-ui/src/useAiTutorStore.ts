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

export function useAiTutorStore() {
  return { messages, isLoading, activeScope, currentCellId }
}
