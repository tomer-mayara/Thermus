import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const portalRoot = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root: portalRoot,
  envDir: portalRoot,
  server: { port: 5173, strictPort: true },
  preview: { port: 5173, strictPort: true },
  build: {
    target: 'es2024',
    outDir: 'dist',
  },
});
