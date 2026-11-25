/**
 * Couch never talks to TMDB directly. It calls the Cloudflare Worker relay
 * (apps/couch-relay), which adds the secret TMDB token on the server side.
 */
export const RELAY_URL: string =
  (import.meta.env.VITE_RELAY_URL as string | undefined)?.replace(/\/$/, '') ||
  'https://couch-relay.mjolnir3286.workers.dev';

export const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';
export const WATCH_REGION = 'US';
