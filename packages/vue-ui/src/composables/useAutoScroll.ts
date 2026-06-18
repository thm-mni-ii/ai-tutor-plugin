import { nextTick, ref, watch, type Ref } from 'vue'

const BOTTOM_THRESHOLD_PX = 48

// Tracks scroll position of a container and decides when to auto-scroll
// vs. show a "jump to bottom" affordance, so callers don't have to.
export function useAutoScroll(scrollEl: Ref<HTMLElement | null>, watchSource: () => unknown) {
  const showScrollButton = ref(false)

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

  // Only stick to the bottom on new content if the user was already there;
  // otherwise leave their scroll position alone so they can keep reading.
  watch(watchSource, () => {
    const el = scrollEl.value
    if (!el) return
    const wasNearBottom = isNearBottom(el)
    void nextTick(() => {
      if (wasNearBottom) scrollToBottom('auto')
      else handleScroll()
    })
  })

  return { showScrollButton, scrollToBottom, handleScroll }
}
