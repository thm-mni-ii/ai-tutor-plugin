import { createI18n } from 'vue-i18n'

export const i18n = createI18n({
  legacy: false,
  locale: 'de',
  fallbackLocale: 'en',
  messages: {
    de: {
      hello: 'Hallo aus Vue',
      chat: {
        title: 'AI Tutor',
        adminMode: 'Admin-Modus',
        you: 'Du',
        tutor: 'Tutor',
        thinking: 'Tutor denkt nach …',
        empty: 'Noch keine Nachrichten. Wähle einen Bereich, um Feedback zu erhalten.',
        scrollToBottom: 'Zum Ende scrollen',
        inputPlaceholder: 'Frage an den Tutor stellen …',
        send: 'Senden',
        attachFile: 'Datei anhängen',
        removeAttachment: 'Anhang entfernen',
        queuePosition: 'Warteschlange: {position}',
        autoScrollOn: 'Auto-Scroll an',
        autoScrollOff: 'Auto-Scroll aus',
        cancelRequest: 'Abbrechen'
      },
      scope: {
        label: 'Feedback-Bereich wählen',
        cell: 'Aktuelle Zelle',
        task: 'Aktuelle Aufgabe',
        sheet: 'Alle Aufgaben'
      }
    },
    en: {
      hello: 'Hello from Vue',
      chat: {
        title: 'AI Tutor',
        adminMode: 'Admin mode',
        you: 'You',
        tutor: 'Tutor',
        thinking: 'Tutor is thinking …',
        empty: 'No messages yet. Choose a scope to get feedback.',
        scrollToBottom: 'Scroll to bottom',
        inputPlaceholder: 'Ask the tutor a question …',
        send: 'Send',
        attachFile: 'Attach file',
        removeAttachment: 'Remove attachment',
        queuePosition: 'Queue position: {position}',
        autoScrollOn: 'Auto-scroll on',
        autoScrollOff: 'Auto-scroll off',
        cancelRequest: 'Cancel'
      },
      scope: {
        label: 'Choose feedback scope',
        cell: 'Current cell',
        task: 'Current exercise',
        sheet: 'All exercises'
      }
    }
  }
})