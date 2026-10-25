import {boardDiagnostics} from './tests/board-dev-server.js';
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  base: './',
  plugins:[boardDiagnostics()],
  server:{cors:{origin:'https://www.owlbear.rodeo'}},
  build: { rollupOptions: { input: {
    cardEditor:fileURLToPath(new URL('./card-editor.html',import.meta.url)),
    sheet: fileURLToPath(new URL('./index.html', import.meta.url)),
    gm: fileURLToPath(new URL('./gm.html', import.meta.url)),
    background: fileURLToPath(new URL('./background.html', import.meta.url)),
  } } },
});
