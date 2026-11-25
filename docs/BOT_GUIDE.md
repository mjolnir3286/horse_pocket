# Horse Pocket bot guide

This repo is Kale G.'s personal mini-app portal, live at
https://mjolnir3286.github.io/horse_pocket/. Apps are static and client-side,
with no user accounts. Follow this guide when you work here, and update it
when the patterns change.

## Layout

- `apps/portal/` — hub at `/horse_pocket/` (Vite 8). Tiles live in `src/apps.ts`.
- `apps/couch/` — movies and shows PWA at `/horse_pocket/couch/` (React 19, Vite 6). Title and credits are in `src/config/site.ts`. The daily collector is in `collector/`.
- `apps/wad/` — budget PWA at `/horse_pocket/wad/` (React 19, Tailwind, Vite 8). Title is in the header; credits are in About. Auto-saves to versioned `localStorage` keys (`wad_budget_v1`, `wad_plan_v1`).
- `apps/couch-relay/` — Cloudflare Worker that forwards an allowlist of TMDB reads so the token never ships in the public site (`https://couch-relay.mjolnir3286.workers.dev`).
- `.github/workflows/deploy.yml` — builds the three apps and publishes one GitHub Pages artifact.
- `.github/workflows/collect.yml` — runs Couch's collector daily at 12:00 UTC (7:00 AM America/New_York), commits `apps/couch/public/data/upcoming-releases.json` when it changes, then calls deploy.

Each app has its own `package.json` and lockfile. Vite bases are `/horse_pocket/`, `/horse_pocket/couch/`, and `/horse_pocket/wad/`. Build output: portal `dist/`, Couch `www/`, Wad `dist/`. Those folders are gitignored.

## Build and deploy

A push to `main` (or a manual / `workflow_call` run) deploys. The workflow uses Node 22, runs `npm ci && npm run build` in each app, then assembles:

- `apps/portal/dist/` → `www/`
- `apps/couch/www/` → `www/couch/`
- `apps/wad/dist/` → `www/wad/`

The root `www/` folder is the Pages artifact, not a source tree.

To add an app: create `apps/<name>/` with Vite `base: '/horse_pocket/<name>/'`; add a tile and icon in `apps/portal/src/apps.ts` (and `public/` if the icon is a file); add an install/build step and a `www/<name>/` copy in `deploy.yml`, including the lockfile in `cache-dependency-path`. Follow the design and menu patterns below.

The relay is deployed separately with `npx wrangler deploy` from `apps/couch-relay/`. Do not redeploy it unless a change needs it.

## Design

Keep the look conservative and neutral. Follow the device light and dark setting (`prefers-color-scheme`); do not add a theme toggle unless the user asks. No ad banners (leftover unused `.ad-*` CSS in Couch is not an invitation to bring them back). Keep credits compact in About, in fine print.

Use a 768px breakpoint. On phones, put primary tabs at the bottom, with a sideways swipe on the tab bar only (no wraparound); on wider screens, put a tab bar under the header. Couch and Wad both do this. Wad keeps a two-tab Budget/Plan layout from 768px up, and four tabs (Income, Taxes, Expenses, Plan) on phones.

Make controls accessible: `aria-label` on icon-only buttons, focus traps and Escape-to-close on menus and dialogs, restore focus on close, and honor `prefers-reduced-motion`.

Reuse these theme colors; do not invent a new palette.

**Portal and Couch** share an indigo/slate palette.

- Dark: bg `#0b0e14`, elevated `#121722`, card `#161c2a`, text `#f8fafc`, muted `#94a3b8`, accent `#6366f1`, accent-bright `#818cf8`. Horse mark: fg `#818cf8`, bg `#1b2240`. Couch icon: outline `#cbdcf0`, fill `#438188`.
- Light: bg `#f4f4f5`, elevated `#fafafa`, card `#ffffff`, text `#18181b`, muted `#52525b`, accent `#4f46e5`, accent-bright `#4338ca`. Horse mark: fg `#4338ca`, bg `#e0e7ff`. Couch icon: outline `#132347`, fill `#458289`.

**Wad** is black/white with a green/orange/red accent set.

- Light: bg `#ffffff`, text `#111111`, money `#00e64d`, accent `#ff8c00`, danger `#ff2d2d`. Wad icon: outline `#14532d`, fill `#00e64d`.
- Dark: bg `#0d0d0d`, text `#f0f0f0`. Wad icon: outline `#b8f5c8`, fill `#12b35a`.

## Icons

Reuse the user's artwork; do not redraw it. The Wad icon is the user's original wallet (word removed) inside the shared clipped-corner frame (`wad-icon.png`, plus 192/512 and maskable PWA icons in `apps/wad/public/icons/`). The portal mark is a hand-drawn SVG horse head in the same clipped-corner frame, in the horse theme colors (`--hp-fg`, `--hp-bg`). Couch is a two-color loveseat SVG (`--couch-outline`, `--couch-fill`). An app's icon is its favicon, its PWA icons if it is a PWA, and its portal tile. Keep icons flat, simple, and in one or two theme colors.

## Shared app patterns

Each mini app should have a left SideMenu with:

- a ‹ Horse Pocket link back to the portal
- Help
- About
- Install, only if the app is a PWA (Couch and Wad both are)
- a Your Data section with Export and Import JSON, plus the note that data is saved on this device only and that clearing browser data erases it

Help is a sheet with collapsible sections and icons (see Couch's `HelpModal`). About has a short description, "Made by Kale G.", "Built with Grok Bot", and compact source credits. Couch also credits TVmaze, TMDB, and JustWatch. Dialogs use a focus trap.

There are no accounts. User data stays on the device. Couch and Wad both store data in versioned `localStorage` keys (`*_v1`) and export a versioned JSON backup (`app`, `version: 1`, `exportedAt`). Wad's keys are `wad_budget_v1` and `wad_plan_v1`; older Wad backups without `plan` still import. When you add stored fields, use a new or bumped `_vN` key so old data is not silently broken.

## Data and cost

Nothing that costs money. Use free APIs and plans only. Do not scrape sites, and do not do anything that goes against a service's terms. Couch's collector uses the public TVmaze API and public RSS feeds, not HTML scraping.

Never put secrets in public code or in GitHub Pages builds. The TMDB token lives only as the Cloudflare Worker secret `TMDB_TOKEN` on `couch-relay` (free plan, 100,000 requests/day). The relay allowlists methods, origins, paths, and query params, and caches successful responses (30 minutes for search, 24 hours for the other allowed routes). Do not add paid Cloudflare features or upgrade the plan.

## Workflow

Turn ideas into GitHub issues labeled `idea`, plus an app label, and refine them in comments. The `ready` label means the user agreed.

Minor fixes, formatting, and visuals on a ready issue may be published without asking again. Major features need the user's approval before they go live. Before pushing anything else, ask if they want anything changed and offer suggestions.

Push back on bad design or best-practice problems before implementing. Do not just build a request that would hurt the app.

Test at 360px and 1280px, in both light and dark mode, before publishing.

Work on a feature branch. Never force-push. A push to `main` publishes the site, so do not merge until required approval is in hand. If the shared checkout is already on another bot's branch, use a git worktree instead of switching branches.
