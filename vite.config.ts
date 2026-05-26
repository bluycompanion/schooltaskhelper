import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const rawBasePath = process.env.VITE_BASE_PATH || '/';
const base = rawBasePath === '/' ? '/' : rawBasePath.endsWith('/') ? rawBasePath : `${rawBasePath}/`;

export default defineConfig({
  base,
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
