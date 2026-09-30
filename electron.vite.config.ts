import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const root = process.cwd()

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: { rollupOptions: { input: resolve(root, 'main/index.ts') } },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: { rollupOptions: { input: resolve(root, 'main/preload.ts') } },
  },
  renderer: {
    root: resolve(root, 'renderer'),
    plugins: [react(), tailwindcss()],
    resolve: { alias: { '@shared': resolve(root, 'shared') } },
    build: {
      outDir: resolve(root, 'out/renderer'),
      emptyOutDir: true,
      rollupOptions: { input: resolve(root, 'renderer/index.html') },
    },
  },
})
