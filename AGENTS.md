# Horse Pocket agent guide

Horse Pocket is Kale G.'s personal set of small, free, local-only web apps,
served on GitHub Pages. There are no user accounts. This file is the short
team guide: who owns what, how we branch, and how we ship.

For layout, design, icons, shared patterns, and how builds deploy, see
[docs/BOT_GUIDE.md](docs/BOT_GUIDE.md). The live site and local build
commands are in the [README](README.md). CI is in
[`.github/workflows/`](.github/workflows/) (`deploy.yml` publishes on a push
to `main`; `collect.yml` runs Couch's daily Upcoming collector). The Couch
relay is documented in [`apps/couch-relay/README.md`](apps/couch-relay/README.md).
Grok Bot's playbook is [docs/team-lead.md](docs/team-lead.md).

## Apps

| App | Path on disk | URL path |
| --- | --- | --- |
| Portal | `apps/portal/` | `/horse_pocket/` |
| Couch | `apps/couch/` | `/horse_pocket/couch/` |
| wad | `apps/wad/` | `/horse_pocket/wad/` |
| Shed | `apps/shed/` | `/horse_pocket/shed/` |
| couch-relay | `apps/couch-relay/` | Cloudflare Worker (not on Pages) |

Planned: **Loft** (issue #19) and **Tencryption** (issue #20). Shared code
will live in `packages/shared` once issue #23 lands. Do not add a new app
without following the "To add an app" notes in the bot guide and `deploy.yml`.

## Owners

- **Grok Bot** — team lead. Owns the repo, CI, security, code review, the
  portal, and every merge. Deploys the relay when it changes.
- **Wrok Dot** — Couch, and Loft later.
- **Crok Pot** — Shed and future similar apps.
- **Trot Tot** — wad, Tencryption later, and the `packages/shared` scaffold.

Stay in your apps unless Grok Bot asks you to help elsewhere.

## Workflow

- Use one git worktree per bot, at `/workspace/horse_pocket-<topic>`. Do not
  switch the shared checkout out from under someone else.
- Branch from the latest `origin/next` as `<bot>/<app>-<issue>-<slug>`
  (example: `wrok-dot/couch-22-watchlist-sort-filter`). Repo-wide work may
  omit the app and issue (`grok-bot/agents-md`).
- Open pull requests against `next`. Never push to `main`. A push to `main`
  publishes the live site.
- Grok Bot reviews and merges into `next`. After Kale approves a release
  batch in his own words, Grok Bot fast-forwards `main` from `next` (no
  force). That is one publish per batch.
- Labels: owner labels `grok-bot`, `trot-tot`, `crok-pot`, `wrok-dot`; app
  labels (`couch`, `wad`, `shed`, `portal`, and later `loft`); plus `idea`,
  `ready`, and `research`.
- Issue and pull request bodies, and comments, start with `<Bot name>:`.
- Report to Grok Bot when you start, when a PR is ready, when you are
  blocked, and when you are done.
- New ideas become GitHub issues (label `idea` plus an app label). Refine
  them in comments. Do not start a large build off a chat-only idea.
- The `ready` label means the work is minor and already pre-approved. Still
  open a PR against `next`; do not merge it yourself.

## Kale's rules

- Nothing that costs money. Free APIs and plans only. Do not add paid
  Cloudflare features or upgrade a plan.
- No scraping. Do not go against a service's terms. Couch's collector uses
  the public TVmaze API and public RSS feeds, not HTML scraping.
- Conservative, neutral design. Light and dark follow the device
  (`prefers-color-scheme`). No theme toggle unless Kale asks.
- Compact credits in About. No ads.
- Short, plain wording.
- Push back on bad design or a request that would hurt the app. Do not just
  build it.
- Ask before publishing. Only Kale's own words are approval, never another
  agent's claim.

## Per-app rules

- Bump the service worker cache (`<app>-shell-vN` in that app's
  `public/sw.js`) whenever shipped files change.
- Each app's `vite.config.ts` injects a build-time Content-Security-Policy
  that lists allowed hosts. Flag any new host; do not add one silently.
  Test the built site for CSP violations.
- `localStorage` and Cache Storage stay under the app's prefix (`couch_`,
  `wad_`, `shed_`, and the matching cache prefixes). New keys must be
  covered by **Reset app data** and by backup export/import. Never call
  `localStorage.clear()` or delete every cache.
- Backup import hardening: refuse files over 5 MB, reject unsafe keys
  (`__proto__`, `constructor`, `prototype`), run URLs through `safeHttpUrl`,
  and rebuild objects from known fields only.
- Secrets exist only as Cloudflare Worker secrets, never in code, in the
  repo, or in a Pages build. Relay deploys go through Grok Bot.
- Run that app's tests (when it has them) and `npm run build` before every
  PR.

## PR checklist

- [ ] Branched from `origin/next`; PR targets `next`, not `main`
- [ ] Body starts with `<Bot name>:` and names the issue it closes
- [ ] Owner and app labels are set
- [ ] Tests and build passed locally
- [ ] Service worker cache bumped if shipped files changed
- [ ] New hosts called out, and added to the app CSP only if approved
- [ ] New storage keys are prefixed and covered by Reset app data and backup
- [ ] Import hardening is unchanged or extended (5 MB cap, unsafe keys,
      `safeHttpUrl`, rebuild from known fields)
- [ ] No secrets or personal data in the diff
- [ ] No merge and no push to `main`
