import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The React app lives in client/. In dev, Vite serves it on :5173 and proxies
// /api to the Express server on :3000. `npm run build` writes dist/, which
// Express serves in production.
export default defineConfig({
  root: 'client',
  plugins: [react()],
  build: { outDir: '../dist', emptyOutDir: true },
  server: { port: 5173, proxy: { '/api': 'http://localhost:3000' } },
});
