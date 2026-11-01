import { resolve } from 'node:path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';

/**
 * Inject a strict Content-Security-Policy into the production bundle only.
 * In development Vite's React refresh preamble needs inline scripts.
 */
function productionCsp(): Plugin {
  const policy = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    "img-src 'self' data:",
    "media-src 'self' data: blob:",
    "connect-src 'self'"
  ].join('; ');
  return {
    name: 'flight-mode-csp',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(
        '<head>',
        `<head>\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`
      );
    }
  };
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: { input: { index: resolve(__dirname, 'electron/main/index.ts') } }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: { input: { index: resolve(__dirname, 'electron/preload/index.ts') } }
    }
  },
  renderer: {
    root: resolve(__dirname, 'src'),
    resolve: { alias: { '@': resolve(__dirname, 'src') } },
    build: {
      rollupOptions: { input: { index: resolve(__dirname, 'src/index.html') } }
    },
    plugins: [react(), productionCsp()]
  }
});
