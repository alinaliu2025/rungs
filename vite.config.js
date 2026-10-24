import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The React app lives in client/. In dev, Vite serves it on PORT (default 5173)
// and proxies /api to the Express server on API_PORT (default 3000).
// `npm run build` writes dist/, which Express serves in production.
export default defineConfig({
  root: 'client',
  plugins: [react()],
  build: { outDir: '../dist', emptyOutDir: true },
  server: {
    port: Number(process.env.PORT) || 5173,
    strictPort: true, // fail loudly instead of drifting to 5174 when the port is taken
    proxy: { '/api': `http://localhost:${process.env.API_PORT || 3000}` },
  },
});
