# Horse Pocket

**Horse Pocket** is a mobile-first, installable Progressive Web App (PWA) for discovering where shows and movies stream, comparing platform subscription costs, tracking Top 3 shows per platform, polling public release announcements, and getting new-episode push alerts.

> **Status:** Skeleton MVP built locally for review (mock/example catalog & pricing by default, plus a working TVmaze-primary release collector with public RSS as a secondary source, and a TMDB `/watch/providers` adapter stub).

---

## Features in This MVP

1. **Where-to-Watch Search (`Discover`)**
   - Instant search across TV series and movies by title, genre, or platform.
   - Filter by media type (`All`, `TV Series`, `Movies`) and by platform.
   - Detail modal showing all carrying platforms, quality (`HD` / `4K UHD`), subscription/rent/buy status, and starting plan price.

2. **Upcoming Releases Collector (`Upcoming` + `collector/runCollector.ts`)**
   - Node/TypeScript script (`npm run collect`) whose **main source** is TVmaze's free, no-key `/schedule/web` API (global + US, past 7 days through the next 14). It maps streaming web channels onto Horse Pocket's tracked platforms. No account or API key is required; the daily job identifies itself as `HorsePocket/1.0 (+https://github.com/mjolnir3286/horse_pocket)` and throttles to stay under TVmaze's rate limit, with backoff on HTTP 429.
   - Public RSS feeds (Google News searches, Deadline, Variety TV, TVLine) are a **secondary** source for premiere news. Extracted titles are cleaned (quotes, trailing premiere phrases, and actor/creator prefixes like `Ayo Edebiri and Will Sharpe's Prodigies` → `Prodigies`). Dates are parsed with `chrono-node` (vague phrases like "this spring" stay unconfirmed) and a subset of RSS leads is confirmed against TVmaze `singlesearch`.
   - **Never drops past-dated leads.** Dates on or after today appear in the **Upcoming** tab; earlier dates stay in history and are listed under that platform as **Available now / recently released**. Each run **merges** into `public/data/upcoming-releases.json` (keeping `firstSeenAt` / `lastSeenAt`) instead of overwriting history.
   - Followed Upcoming leads trigger the existing push notification flow.
   - Plan costs and back-catalog "where to watch" remain example data we maintain (TVmaze does not cover those).

3. **Watchlist & New Episode Push Alerts (`Watchlist`)**
   - Follow/unfollow shows (persisted in `localStorage`).
   - Browser `Notification.requestPermission()` integration + Service Worker (`public/sw.js`).
   - **"Check for New Episodes"** simulation button that checks both followed series and matching Upcoming collector leads, firing a real Service Worker notification (with in-app toast fallback when browser notifications are blocked).

4. **Platforms, Subscription Costs & Top 3 Shows (`Platforms`)**
   - **Priority platforms shown first:** Netflix, Disney+, Hulu, Amazon Prime Video, HBO Max (Max).
   - **Secondary platforms included:** Apple TV+, Peacock, Paramount+.
   - Clearly labeled **example / approximate plan tiers and pricing (as of Nov 2026)** plus subscription-required indicators.
   - Clickable **Top 3 Shows** per platform, an **Available now / recently released** section fed by collector history, and an expandable per-platform catalog drawer.

5. **Unobtrusive Ad Placeholders + Mock Premium Toggle**
   - Two low-key ad placeholders in Free Tier preview: a native-style sponsored card in feeds and a slim dismissible footer banner.
   - Top-bar **Free Tier / Premium** toggle hides all ad slots immediately to preview the ad-free experience.

6. **Installable PWA (Android-Compatible & Capacitor-Ready)**
   - `public/manifest.webmanifest` + PNG icons (`192x192`, `512x512`) + offline-capable Service Worker (`public/sw.js`).
   - Supports Android Chrome **Add to Home screen** (`beforeinstallprompt` + fallback instructions) and is structured cleanly for wrapping with **Capacitor** (`capacitor.config.example.ts`).
   - **Light and dark themes** follow the device `prefers-color-scheme` setting (no in-app toggle). Dark keeps the current navy palette; light uses conservative neutral grays with a slightly toned-down indigo accent. Browser chrome `theme-color` meta tags cover both schemes (`#0b0e14` / `#f4f4f5`); the web manifest `theme_color` / `background_color` stay `#0b0e14` as the install-splash fallback (the format only allows one value).

7. **Welcome and About cards**
   - A first-visit welcome card explains where to watch, upcoming shows, and alerts. The help icon in the header reopens it. A separate info icon opens an About card with a short site description, a "Made by Kale G." link to the public repo, a small "Built with Grok Bot" note, compact TVmaze attribution, and a line that Horse Pocket isn't affiliated with any streaming service or data provider. Credits and maker links live in `src/config/site.ts`. The app UI uses relative paths (Vite `BASE_URL`) so it can be hosted anywhere; it does not hardcode a GitHub Pages URL.

Nothing in this MVP requires a paid plan, paid API key, or stored phone numbers. Public GitHub Pages + Actions, TVmaze, and RSS feeds are free. Browser push in this preview uses the Notification API and a service worker on-device (no user phone-number database). Production Web Push would store a browser push subscription (a public key + endpoint), not a phone number.

---

## Tech Stack

- **Frontend:** React 19 + TypeScript + Vite 6
- **Icons:** `lucide-react`
- **PWA:** Web App Manifest + Service Worker (`public/sw.js`)
- **Collector:** `tsx` + `fast-xml-parser` + `chrono-node` + TVmaze free API
- **Data Layer:** `StreamingProvider` interface (`src/services/streamingProvider.ts`) with:
  - `MockStreamingProvider` (default, clearly labeled example data)
  - `TmdbStreamingProvider` (`src/services/tmdbProvider.ts`) activating automatically when `VITE_TMDB_API_KEY` is set

---

## Running Locally

```bash
npm install
npm run collect   # Merge TVmaze schedule + RSS leads into public/data/upcoming-releases.json
npm run dev       # http://localhost:4173/horse_pocket/
```

The Vite `base` is `/horse_pocket/` so local dev/preview match GitHub Pages (`https://<user>.github.io/horse_pocket/`).

### Production Build & Preview

```bash
npm run build     # Outputs to ./www (not committed; see .gitignore)
npm run preview   # http://localhost:4173/horse_pocket/
```

### GitHub Pages Deploy

Two workflows ship in `.github/workflows/`:

- **`deploy.yml`** — on push to `main` (and manual dispatch) builds the app and deploys `./www` with `actions/deploy-pages`.
- **`collect.yml`** — daily cron (`0 12 * * *`, 7:00 AM America/New_York) plus manual dispatch: runs the collector, commits an updated `public/data/upcoming-releases.json` to `main` if it changed, then calls `deploy.yml` so the site refreshes (a `GITHUB_TOKEN` push alone would not start the deploy workflow).

After the first push, enable **Settings → Pages → Source: GitHub Actions** on the repository. The public site URL will be `https://mjolnir3286.github.io/horse_pocket/`.

---

## Architecture & Real API Integration

### Why Public Feeds / TMDB / TVmaze Instead of Scraping
Major streaming services (Netflix, Disney+, Hulu, Amazon Prime Video, HBO Max, etc.) **do not offer public catalog APIs** and restrict automated scraping in their Terms of Service.

Horse Pocket combines two compliant data paths:
1. **Catalog & Where-to-Watch (`TMDB`):** Designed around TMDB's free API (`/search/multi`, `/tv/{id}/watch/providers`, `/movie/{id}/watch/providers`, `/discover/tv`), which uses JustWatch-sourced provider availability. Set `VITE_TMDB_API_KEY` in `.env` (from `.env.example`) to activate `TmdbStreamingProvider`; otherwise it runs on `MockStreamingProvider`.
2. **Release Alert Collector (`TVmaze` primary, RSS secondary):** The daily job pulls TVmaze's free no-key `/schedule/web` feed for global and US streaming dates and maps web channels to platforms. Public news/press RSS feeds still contribute premiere announcements (`unconfirmed` until confirmed via TVmaze `singlesearch`). Past-dated leads are retained in collector history and shown under the matching platform as available now; only future dates appear in Upcoming. TVmaze data is licensed [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/); attribution is a compact credit on the About card (`src/config/site.ts`). ShareAlike applies to redistributed TVmaze data, not to the app's code or design.

### How Real Push Notifications Work in Production
The MVP simulates episode release checks locally via the Service Worker. For real background alerts:
1. **Backend scheduler (cron / worker):** Periodically runs the RSS/TVmaze/TMDB collector and checks upcoming episode air dates for shows followed by users.
2. **PWA delivery:** Store each user's `PushSubscription` and dispatch encrypted payloads via **Web Push (VAPID)** to `self.addEventListener('push', ...)` in `public/sw.js`.
3. **Android native delivery (Capacitor):** Install `@capacitor/core`, `@capacitor/android`, and `@capacitor/push-notifications`, copy `capacitor.config.example.ts` to `capacitor.config.ts`, and route pushes through **Firebase Cloud Messaging (FCM)**.

---

## Data sources & attribution

- **Upcoming / new-episode dates:** TVmaze (`https://api.tvmaze.com`), no account or key. Licensed [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). The About card credits TVmaze with a link back to [tvmaze.com](https://www.tvmaze.com) and the license. Only the scheduled collector job calls TVmaze; the live site reads a static JSON file.
- **Premiere news (secondary):** public RSS (Google News, Deadline, Variety, TVLine).
- **Catalog, where-to-watch, and plan prices:** example/mock data in this MVP (optional TMDB adapter is stubbed and unused unless `VITE_TMDB_API_KEY` is set).

## Non-Ad, Premium-Feel Monetization Ideas

1. **Horse Pocket Pro (Ad-Free + Smart Subscription Optimizer)**
   - Monthly/annual tier (e.g., $2.99–$4.99/mo) that removes ads and recommends which streaming services to pause or rotate each month based on your watchlist to save $20–$50/mo.
2. **Instant Multi-Device & Priority Episode Alerts**
   - Free users get daily digest notifications; Pro users get instant push alerts the moment a new episode drops, plus cross-device sync (web + Android + email/calendar).
3. **Price-Drop, Deal & Rent/Buy Alerts**
   - Tracks paid movie rentals/purchases or streaming bundle promos and notifies users when a title drops in price or moves from rent-only to an included subscription.
4. **Household & Shared Watchlists**
   - Family/partner profiles that merge watchlists, track "what we both want to watch tonight," and show combined platform coverage across everyone's subscriptions.
5. **Streaming Calendar Sync**
   - Private `.ics` / Google Calendar / Apple Calendar feed of upcoming episode air dates and season premieres for followed shows.
6. **Affiliate Streaming Referrals (Zero-Ad Revenue)**
   - Clean, transparent "Start Streaming" links to platforms or bundle offers (Disney Bundle, Prime Video Channels, Paramount+ trials) earning referral commissions without display ads.
7. **Bundle & Tier Calculator ("Cheapest Way to Watch Everything")**
   - Interactive tool comparing ad-supported vs. ad-free bundles, annual discounts, and carrier/credit-card perks to build the lowest-cost stack for a user's exact watchlist.
