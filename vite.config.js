import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  base: './',
  build: { rollupOptions: { input: {
    sheet: fileURLToPath(new URL('./index.html', import.meta.url)),
    gm: fileURLToPath(new URL('./gm.html', import.meta.url)),
    background: fileURLToPath(new URL('./background.html', import.meta.url)),
  } } },
});
