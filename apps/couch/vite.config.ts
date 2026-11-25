import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Security policy for the built site. GitHub Pages can't send custom headers, so this is a
 * <meta> CSP plus a referrer policy, added at build time only (the dev server's hot reload
 * needs inline scripts). Couch talks only to its relay (TMDB), TVmaze, and TMDB images.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https://image.tmdb.org",
  "connect-src 'self' https://couch-relay.mjolnir3286.workers.dev https://api.tvmaze.com",
  "font-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');
const REFERRER = 'strict-origin-when-cross-origin';

const securityMeta = (): Plugin => ({
  name: 'horse-pocket-security-meta',
  apply: 'build',
  transformIndexHtml: () => [
    { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP }, injectTo: 'head-prepend' },
    { tag: 'meta', attrs: { name: 'referrer', content: REFERRER }, injectTo: 'head-prepend' },
  ],
});

export default defineConfig({
  base: '/horse_pocket/couch/',
  plugins: [react(), securityMeta()],
  build: {
    outDir: 'www',
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
