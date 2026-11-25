# Horse Pocket

**Horse Pocket** is Kale G.’s personal mini-app portal, served on GitHub Pages at `https://mjolnir3286.github.io/horse_pocket/`.

All apps are static, client-side web apps with no user accounts or paid services. Couch uses one free Cloudflare Worker (`apps/couch-relay`) to keep its TMDB token out of the public site.

## Apps

| App | Path | Purpose | Stack |
| --- | --- | --- | --- |
| **Horse Pocket** | `/horse_pocket/` (`apps/portal`) | Neutral portal hub linking to each mini app | Vite 8, TypeScript |
| **Couch** | `/horse_pocket/couch/` (`apps/couch`) | Movie and show search with US where-to-watch (TMDB / JustWatch via the relay), follows with new-episode alerts on open (TVmaze), hand-checked plan prices, TVmaze + RSS Upcoming feed | React 19, TypeScript, Vite 6 |
| **Wad** | `/horse_pocket/wad/` (`apps/wad`) | Budget planner for take-home pay, taxes, expenses, savings goals, and CSV export/import (brought in from [`mjolnir3286/wad-app`](https://github.com/mjolnir3286/wad-app)) | React 19, TypeScript, Tailwind CSS, Recharts, Vite 8 |

## Repository Layout

- `apps/portal/` — Portal root page (`base: '/horse_pocket/'`)
- `apps/couch/` — Couch where-to-watch PWA (`base: '/horse_pocket/couch/'`, app title configured in `apps/couch/src/config/site.ts`) and daily TVmaze/RSS collector (`apps/couch/collector/`)
- `apps/couch-relay/` — Cloudflare Worker that forwards an allowlist of TMDB read requests for Couch and adds the secret token (`https://couch-relay.mjolnir3286.workers.dev`, see its README)
- `apps/wad/` — Wad budget app (`base: '/horse_pocket/wad/'`)
- `.github/workflows/deploy.yml` — Builds all three apps and publishes them into one GitHub Pages artifact (`www/` at root, `www/couch/`, `www/wad/`)
- `.github/workflows/collect.yml` — Runs `npm run collect` in `apps/couch/` daily at `12:00 UTC` (7:00 AM America/New_York), updates `apps/couch/public/data/upcoming-releases.json` when changed, and triggers `deploy.yml`

## Local Build & Preview

Each app has its own `package.json` and `package-lock.json`:

```bash
# Portal
cd apps/portal && npm ci && npm run build

# Couch (plus collector)
cd apps/couch && npm ci && npm run collect && npm run build

# Wad
cd apps/wad && npm ci && npm run build
```
