/**
 * Returns the URL only if it is an absolute http(s) link, otherwise null.
 * Used for every external link and window.open, since some URLs come from feeds,
 * TMDB, or imported backups (blocks javascript:, data:, and similar schemes).
 */
export function safeHttpUrl(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 2048) return null;
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null;
  } catch {
    return null;
  }
}
