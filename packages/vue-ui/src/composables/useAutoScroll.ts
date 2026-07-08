import { nextTick, ref, watch, type Ref } from 'vue'

const BOTTOM_THRESHOLD_PX = 48

// Tracks scroll position of a container and decides when to auto-scroll
// vs. show a "jump to bottom" affordance, so callers don't have to.
export function useAutoScroll(scrollEl: Ref<HTMLElement | null>, watchSource: () => unknown) {
  const showScrollButton = ref(false)
  const autoScrollEnabled = ref(true)

  function isNearBottom(el: HTMLElement): boolean {
    return el.scrollHeight - el.scrollTop - el.clientHeight < BOTTOM_THRESHOLD_PX
  }

  function scrollToBottom(behavior: ScrollBehavior = 'smooth'): void {
    const el = scrollEl.value
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior })
    showScrollButton.value = false
  }

  function handleScroll(): void {
    const el = scrollEl.value
    if (el) showScrollButton.value = !isNearBottom(el)
  }

  // Only stick to the bottom on new content if the user was already there
  // AND auto-scroll is enabled. When disabled, the user is reading history
  // and we never interrupt their scroll position.
  watch(watchSource, () => {
    const el = scrollEl.value
    if (!el) return
    const wasNearBottom = isNearBottom(el)
    void nextTick(() => {
      if (autoScrollEnabled.value && wasNearBottom) scrollToBottom('auto')
      else handleScroll()
    })
  })

  return { showScrollButton, autoScrollEnabled, scrollToBottom, handleScroll }
}
