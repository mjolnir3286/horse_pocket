# couch-relay

A tiny Cloudflare Worker (free Workers plan) that lets Couch use TMDB without
putting the TMDB token in the public site.

```
Couch (GitHub Pages) ──GET /tmdb/search/multi?query=dune──▶ couch-relay (Cloudflare)
                                                             │ adds Authorization: Bearer <TMDB_TOKEN>
                                                             ▼
                                                        api.themoviedb.org/3
```

Live at `https://couch-relay.mjolnir3286.workers.dev`.

## What it allows

- **Methods:** `GET` (and `OPTIONS` for CORS preflight). Everything else gets `405`.
- **Origins:** `https://mjolnir3286.github.io`, plus `http://localhost:*` and `http://127.0.0.1:*` for
  development. Any other origin, or no `Origin` header, gets `403`.
- **Paths** (prefixed with `/tmdb`), everything else gets `404`:
  - `/search/multi`, `/search/movie`, `/search/tv`
  - `/movie/{id}`, `/tv/{id}`
  - `/movie/{id}/watch/providers`, `/tv/{id}/watch/providers`
  - `/tv/{id}/external_ids`
  - `/discover/movie`, `/discover/tv`
  - `/configuration`
- **Query parameters:** only `query, page, language, region, include_adult, watch_region,
  with_watch_providers, with_watch_monetization_types, sort_by, vote_count.gte, append_to_response`
  (and `append_to_response` only with `watch/providers` / `external_ids`). Others are dropped.
- Successful answers are cached briefly with the Workers Cache API (10 minutes for search, 1 hour for
  details/providers/discover, 1 day for external ids/configuration). The response body is TMDB's JSON only.

The `Origin` check stops other websites from using the relay from visitors' browsers. A script outside a
browser can fake an `Origin` header, so this is a fence, not a lock: the worst case is someone using up the
free daily request quota or TMDB rate-limiting the token. It can never cost money on the free plan.

## Secret

`TMDB_TOKEN` = the TMDB **API Read Access Token** (v4, the long one) from
https://www.themoviedb.org/settings/api. It's stored as an encrypted Worker secret, never in this repo.

Set or rotate it in the dashboard: **Workers & Pages → couch-relay → Settings → Variables and Secrets →
Add → Type: Secret, Name: `TMDB_TOKEN`, Value: (paste) → Deploy**. Or from a terminal:

```bash
cd apps/couch-relay
npx wrangler secret put TMDB_TOKEN   # paste when prompted
```

If the secret is missing the relay answers `503 {"error":"Relay not configured"}`.

## Deploy

```bash
cd apps/couch-relay
npx wrangler deploy
```

Free plan only: 100,000 requests/day. When the limit is reached, requests fail until the next day; nothing
is billed unless the account is upgraded on purpose.
