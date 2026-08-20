import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // File watching is also disabled there to prevent agent-edit flicker.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},

      // When a host starts Vite directly instead of the Express entrypoint,
      // forward /api requests to the Express API server. Without this, Vite
      // can serve index.html for /api/* with HTTP 200, producing the classic
      // `Unexpected token '<'` JSON parsing failure in the browser.
      proxy: {
        '/api': {
          target: `http://127.0.0.1:${Number(process.env.SERVER_API_PORT || process.env.API_PORT || 3000)}`,
          changeOrigin: true,
          secure: false,
        },
      },
    }
  };
});
