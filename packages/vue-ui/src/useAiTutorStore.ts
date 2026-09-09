import { ref } from 'vue'

export type MessageRole = 'user' | 'assistant'

// Mirrors the backend's `_context_cell` allowlist (ai-tutor-backend/app/prompts.py) —
// exactly what the tutor saw for one notebook cell, never anything more.
export interface SentCellOutput {
  type: string
  text: string
}

export interface SentCellError {
  ename: string
  evalue: string
  traceback_head: string
}

export interface SentCell {
  id: string | null
  cell_type: string
  source: string
  // 'unchanged' is the only value the backend sends until §3's delta tracking
  // lands; new/changed will follow the same key naming under `context.*` in i18n.
  status: string
  outputs?: SentCellOutput[]
  error?: SentCellError
}

// The context block echoed by the backend as the first SSE frame — see
// ARCHITECTURE_PLAN_v3.md §2. `has_reference_solution` is a boolean only,
// never the solution text itself.
export interface SentContext {
  scope: string
  cell_id: string | null
  file_name: string | null
  cells: SentCell[]
  removed_cell_ids: string[]
  has_reference_solution: boolean
}

export interface ChatMessage {
  role: MessageRole
  content: string
  // Only ever set on user-turn messages; null until the backend's context
  // frame arrives, absent entirely on assistant turns.
  context?: SentContext | null
}

export type FeedbackScope = 'cell' | 'task' | 'sheet'

// All refs declared at module scope — every caller of useAiTutorStore()
// shares the same reactive state, including code outside Vue components.
const messages = ref<ChatMessage[]>([])
const isLoading = ref(false)
const activeScope = ref<FeedbackScope | null>(null)
const currentCellId = ref<string | null>(null)
// Human-readable label for the currently tracked cell, e.g. "Zelle 3 · import pandas as pd…"
// Set by the JupyterLab entry point (src/index.ts) whenever the active cell changes.
const activeCellLabel = ref<string | null>(null)

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
  return {
    messages,
    isLoading,
    activeScope,
    currentCellId,
    activeCellLabel,
    streamingContent,
    queuePosition,
    selectedModel,
  }
}
