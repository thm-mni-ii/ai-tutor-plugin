import { createApp, type App as VueApp } from 'vue'
import { i18n } from './i18n'
import AiTutorPanel from './AiTutorPanel.vue'
import { useAiTutorStore } from './useAiTutorStore.ts'
// styles are provided from JupyterLab

export type VueWidgetHandle = {
  app: VueApp
  unmount: () => void
}

export function mountVueWidget(
  el: HTMLElement,
  props?: Record<string, unknown>
): VueWidgetHandle {
  const app = createApp(AiTutorPanel, props)

  app.use(i18n)
  app.mount(el)

  return {
    app,
    unmount: () => app.unmount()
  }
}

export {
  useAiTutorStore
};