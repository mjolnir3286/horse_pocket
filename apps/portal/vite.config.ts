import { defineConfig } from 'vite';

export default defineConfig({
  base: '/horse_pocket/',
  build: {
    outDir: 'dist',
  },
  server: {
    host: '0.0.0.0',
    port: 4173,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
  },
});
