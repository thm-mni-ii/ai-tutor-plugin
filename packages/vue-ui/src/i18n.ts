import { createI18n } from 'vue-i18n'

export const i18n = createI18n({
  legacy: false,
  locale: 'de',
  fallbackLocale: 'en',
  messages: {
    de: {
      hello: 'Hallo aus Vue'
    },
    en: {
      hello: 'Hello from Vue'
    }
  }
})