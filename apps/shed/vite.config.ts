import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Security policy for the built site. GitHub Pages can't send custom headers, so this is a
 * <meta> CSP plus a referrer policy, added at build time only (the dev server's hot reload
 * needs inline scripts). Shed runs OCR locally: Tesseract's WASM needs 'wasm-unsafe-eval'; camera frames and photos use blob:/mediastream:.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob: mediastream:",
  "connect-src 'self' data: blob:",
  "font-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');
const REFERRER = 'same-origin';

const securityMeta = (): Plugin => ({
  name: 'horse-pocket-security-meta',
  apply: 'build',
  transformIndexHtml: () => [
    { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP }, injectTo: 'head-prepend' },
    { tag: 'meta', attrs: { name: 'referrer', content: REFERRER }, injectTo: 'head-prepend' },
  ],
});


const appRoot = fileURLToPath(new URL('.', import.meta.url));
const sharedRoot = fileURLToPath(new URL('../../packages/shared', import.meta.url));
const sharedSrc = fileURLToPath(new URL('../../packages/shared/src', import.meta.url));

export default defineConfig({
  base: '/horse_pocket/shed/',
  resolve: {
    alias: {
      '@hp/shared': sharedSrc,
    },
  },
  plugins: [react(), securityMeta()],
  build: {
    outDir: 'dist',
  },
  server: {
    host: '0.0.0.0',
    port: 4175,
    fs: {
      allow: [appRoot, sharedRoot],
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 4175,
  },
});
