/**
 * Couch TMDB relay (Cloudflare Worker, free plan).
 *
 * Couch (a static site on GitHub Pages) calls this Worker instead of TMDB,
 * so the TMDB read access token never ships to browsers.
 *
 * - GET only, a short allowlist of TMDB v3 read endpoints, under /tmdb/...
 * - Query parameters are allowlisted too; anything else is dropped.
 * - CORS only for https://mjolnir3286.github.io. http://localhost:* / 127.0.0.1:* are allowed
 *   only when the ALLOW_LOCAL_ORIGINS var is "true" (local dev; off by default and in production).
 *   Requests without an allowed Origin are refused with 403.
 * - Adds `Authorization: Bearer <TMDB_TOKEN>` (Worker secret) server-side.
 * - Caches successful responses with the Workers Cache API, and sends Cache-Control so browsers can reuse them (30 minutes for search, 24 hours for details, providers, season providers, recommendations, discover, and trending).
 * - Discover and trending have their own strict parameter rules (see ROUTE_PARAMS).
 * - Returns only TMDB's JSON body for 200s. Other upstream statuses become a generic JSON error
 *   (404 stays 404, 429 stays 429, everything else is 502) so TMDB error details never pass through.
 */

const TMDB_BASE = 'https://api.themoviedb.org/3';
const PROD_ORIGIN = 'https://mjolnir3286.github.io';
const LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?$/;

// path regex -> cache seconds
const ROUTES = [
  [/^\/search\/(multi|movie|tv)$/, 1800],
  [/^\/(movie|tv)\/\d{1,9}$/, 86400],
  [/^\/(movie|tv)\/\d{1,9}\/watch\/providers$/, 86400],
  [/^\/tv\/\d{1,9}\/external_ids$/, 86400],
  [/^\/tv\/\d{1,9}\/season\/\d{1,3}\/watch\/providers$/, 86400],
  [/^\/(movie|tv)\/\d{1,9}\/recommendations$/, 86400],
  [/^\/discover\/(movie|tv)$/, 86400],
  [/^\/trending\/(all|movie|tv)\/week$/, 86400],
  [/^\/configuration$/, 86400],
];

const ALLOWED_PARAMS = new Set([
  'query',
  'page',
  'language',
  'region',
  'include_adult',
  'watch_region',
  'with_watch_providers',
  'with_watch_monetization_types',
  'sort_by',
  'vote_count.gte',
  'append_to_response',
]);
const ALLOWED_APPEND = new Set(['watch/providers', 'external_ids']);

// Per-route parameter rules: only these keys, and each value must pass its check.
const MONETIZATION = new Set(['flatrate', 'free', 'ads']);
const DISCOVER_PARAMS = {
  watch_region: (v) => v === 'US',
  with_watch_providers: (v) => /^\d{1,6}(\|\d{1,6}){0,9}$/.test(v),
  with_watch_monetization_types: (v) => v.split('|').every((t) => MONETIZATION.has(t)),
  sort_by: (v) => v === 'popularity.desc',
  include_adult: (v) => v === 'false',
  language: (v) => v === 'en-US',
  page: (v) => /^[1-5]$/.test(v),
  'vote_count.gte': (v) => /^\d{1,5}$/.test(v),
};
const TRENDING_PARAMS = {
  language: (v) => v === 'en-US',
  page: (v) => /^[1-5]$/.test(v),
};
const ROUTE_PARAMS = [
  [/^\/discover\/(movie|tv)$/, DISCOVER_PARAMS],
  [/^\/trending\//, TRENDING_PARAMS],
];

function isAllowedOrigin(origin, env) {
  if (!origin) return false;
  if (origin === PROD_ORIGIN) return true;
  return env?.ALLOW_LOCAL_ORIGINS === 'true' && LOCAL_ORIGIN.test(origin);
}

function upstreamError(status, origin) {
  if (status === 404) return jsonError(404, 'Not found', origin);
  if (status === 429) return jsonError(429, 'Rate limited, try again later', origin);
  return jsonError(502, 'Upstream error', origin);
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function jsonError(status, message, origin) {
  const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
  if (origin) Object.assign(headers, corsHeaders(origin));
  return new Response(JSON.stringify({ error: message }), { status, headers });
}

function sanitizeStrict(searchParams, rules) {
  const out = new URLSearchParams();
  for (const [key, value] of searchParams) {
    const check = rules[key];
    if (!check || value.length > 200 || out.has(key) || !check(value)) continue;
    out.set(key, value);
  }
  out.sort();
  return out;
}

function sanitizeQuery(searchParams, tmdbPath = '') {
  const strict = ROUTE_PARAMS.find(([re]) => re.test(tmdbPath));
  if (strict) return sanitizeStrict(searchParams, strict[1]);
  const out = new URLSearchParams();
  for (const [key, value] of searchParams) {
    if (!ALLOWED_PARAMS.has(key) || value.length > 200 || out.has(key)) continue;
    if (key === 'append_to_response') {
      const parts = value.split(',').filter((p) => ALLOWED_APPEND.has(p));
      if (parts.length) out.set(key, parts.join(','));
      continue;
    }
    out.set(key, value);
  }
  // Stable order so equivalent requests share a cache entry.
  out.sort();
  return out;
}

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin');
    const allowed = isAllowedOrigin(origin, env);

    if (!allowed) return jsonError(403, 'Origin not allowed');

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }
    if (request.method !== 'GET') return jsonError(405, 'Method not allowed', origin);

    const url = new URL(request.url);
    if (!url.pathname.startsWith('/tmdb/')) return jsonError(404, 'Not found', origin);
    const tmdbPath = url.pathname.slice('/tmdb'.length);
    const route = ROUTES.find(([re]) => re.test(tmdbPath));
    if (!route) return jsonError(404, 'Endpoint not allowed', origin);
    const ttl = route[1];

    if (!env.TMDB_TOKEN) return jsonError(503, 'Relay not configured', origin);

    const query = sanitizeQuery(url.searchParams, tmdbPath);
    const qs = query.toString();
    const upstreamUrl = `${TMDB_BASE}${tmdbPath}${qs ? `?${qs}` : ''}`;

    // Cache key does not depend on Origin; CORS headers are added per response.
    const cacheKey = new Request(`https://couch-relay.cache/${tmdbPath}?${qs}`, { method: 'GET' });
    const cache = caches.default;
    let cached = null;
    try {
      cached = await cache.match(cacheKey);
    } catch {
      cached = null;
    }

    let body;
    let cacheState = 'MISS';
    if (cached && cached.status === 200) {
      body = await cached.text();
      cacheState = 'HIT';
    } else {
      let upstream;
      try {
        upstream = await fetch(upstreamUrl, {
          headers: {
            Authorization: `Bearer ${env.TMDB_TOKEN}`,
            Accept: 'application/json',
          },
        });
      } catch {
        return jsonError(502, 'Upstream unavailable', origin);
      }
      if (upstream.status !== 200) {
        // Drain and drop TMDB's error body; callers get a generic JSON error.
        await upstream.body?.cancel().catch(() => undefined);
        return upstreamError(upstream.status, origin);
      }
      body = await upstream.text();
      const isJson = (upstream.headers.get('Content-Type') || '').includes('application/json');
      if (!isJson) return jsonError(502, 'Unexpected upstream response', origin);
      const toCache = new Response(body, {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': `public, max-age=${ttl}`,
        },
      });
      ctx.waitUntil(cache.put(cacheKey, toCache).catch(() => undefined));
    }

    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': `public, max-age=${ttl}`,
        'X-Relay-Cache': cacheState,
        ...corsHeaders(origin),
      },
    });
  },
};
