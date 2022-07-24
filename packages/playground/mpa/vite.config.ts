import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import conventionalEntries from 'vite-plugin-conventional-entries';
import conventionalRoutes from 'vite-plugin-conventional-routes';

// https://vitejs.dev/config/
export default defineConfig({
  base: '/base/',
  plugins: [
    react(),
    conventionalEntries({ entries: { basePath: '/base', dir: 'src' } }),
    conventionalRoutes(),
  ],
});
