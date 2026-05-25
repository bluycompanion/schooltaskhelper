import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  root: 'apps/web',
  server: {
    port: 5173,
    proxy: {
      '/tasks': 'http://localhost:3001',
      '/children': 'http://localhost:3001',
    },
  },
  build: {
    outDir: '../../dist/web',
    emptyOutDir: true,
  },
});
