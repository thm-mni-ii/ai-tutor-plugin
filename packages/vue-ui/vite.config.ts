import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
  build: {
    // The package's "build" script runs type-check/build:types (emits .d.ts
    // into dist/) and this Vite build in parallel (run-p) for speed. Vite
    // empties outDir by default, which races with vue-tsc writing the .d.ts
    // files and can wipe them. Disable that so both outputs coexist.
    emptyOutDir: false,
    lib: {
      entry: fileURLToPath(new URL('./src/index.ts', import.meta.url)),
      name: 'VueWidgetUi',
      formats: ['es'],
      fileName: 'index'
    },
    rollupOptions: {
      external: ['vue', 'vue-i18n']
    }
  }
})
