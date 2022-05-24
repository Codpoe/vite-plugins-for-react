import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import conventionalEntries from 'vite-plugin-conventional-entries';
import conventionalRoutes from 'vite-plugin-conventional-routes';

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    proxy: {
      '/api': 'http://example.com/api',
      '^/other-api': 'http://example.com/other-api',
    },
  },
  plugins: [react(), conventionalEntries(), conventionalRoutes()],
});
