import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/horse_pocket/shed/',
  plugins: [react()],
  build: {
    outDir: 'dist',
  },
  server: {
    host: '0.0.0.0',
    port: 4175,
  },
  preview: {
    host: '0.0.0.0',
    port: 4175,
  },
});
