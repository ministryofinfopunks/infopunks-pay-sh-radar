import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { initialBootShellScript } from './src/web/bootContext';

const apiTarget = process.env.VITE_API_TARGET ?? 'http://localhost:8787';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'radar-initial-boot-context',
      transformIndexHtml(html) {
        return html.replace('<!-- radar-boot-context -->', `<script>${initialBootShellScript()}</script>`);
      }
    }
  ],
  server: { port: 5173, proxy: { '/v1': apiTarget, '/health': apiTarget, '/version': apiTarget } },
  preview: { port: 4173 },
  build: {
    outDir: 'dist/client',
    emptyOutDir: true,
    sourcemap: false
  },
  test: { environment: 'node', globals: true }
});
