import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * Security policy for the built site. GitHub Pages can't send custom headers, so this is a
 * <meta> CSP plus a referrer policy, added at build time only (the dev server's hot reload
 * needs inline scripts). wad makes no network calls; everything is local.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "connect-src 'self'",
  "font-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ')
const REFERRER = 'same-origin'

const securityMeta = (): Plugin => ({
  name: 'horse-pocket-security-meta',
  apply: 'build',
  transformIndexHtml: () => [
    { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP }, injectTo: 'head-prepend' },
    { tag: 'meta', attrs: { name: 'referrer', content: REFERRER }, injectTo: 'head-prepend' },
  ],
})

// https://vite.dev/config/

const appRoot = fileURLToPath(new URL('.', import.meta.url))
const sharedRoot = fileURLToPath(new URL('../../packages/shared', import.meta.url))
const sharedSrc = fileURLToPath(new URL('../../packages/shared/src', import.meta.url))

export default defineConfig({
  base: '/horse_pocket/wad/',
  resolve: {
    alias: {
      '@hp/shared': sharedSrc,
    },
  },
  plugins: [react(), tailwindcss(), securityMeta()],
  server: {
    fs: {
      allow: [appRoot, sharedRoot],
    },
  },
})
