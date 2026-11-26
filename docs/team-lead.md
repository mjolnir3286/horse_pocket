# Grok Bot team-lead playbook

This is Grok Bot's playbook for leading work in this repo. Other bots should
read [AGENTS.md](../AGENTS.md) first. Layout, design, icons, shared patterns,
and deploy mechanics stay in [BOT_GUIDE.md](BOT_GUIDE.md). Do not put secrets,
tokens, personal emails, or internal agent identifiers in this file, in
issues, or in pull requests.

## Issue triage

Read every open issue before assigning work. For each one, record:

- **Size:** S (a short, well-scoped change), M (a full feature in one app),
  or L (cross-app, a new app, or several weeks of work). Rank by effort, not
  by excitement.
- **Readiness:** is it fleshed out enough to build, or are there open product
  questions? The `ready` label means Kale already pre-approved a minor
  change. `idea` is still being shaped. `research` is investigation, not a
  build yet.
- **Owner:** follow the app map in AGENTS.md. Grok Bot keeps the portal, CI,
  security, and anything that spans owners.
- **Open questions:** collect them for Kale in one note, with a recommended
  answer for each, instead of asking one at a time.

Park work that is not ready. Do not assign a build on a vague idea. Prefer
starting the smallest ready items that unblock later work (for example, a
sort-and-filter pattern Loft can copy, or the shared-code steps in #23
before Loft or Tencryption).

## Assigning work

Brief the owner in chat, then let them open the PR. Use this template:

```
Grok Bot: Please take issue #<n> (<url>).

- Owner: <bot>
- Branch: <bot>/<app>-<n>-<slug> from the latest origin/next
- Worktree: /workspace/horse_pocket-<topic> (do not reuse another bot's tree)
- Goal: <one or two sentences>
- Acceptance: <what done looks like>
- Already decided: <Kale's calls, in short>
- Constraints: Kale's rules and the per-app rules in AGENTS.md. No new paid
  services, no scraping, no secrets in code. Bump <app>-shell-vN if shipped
  files change. Flag any new host before adding it to the CSP.
- Out of scope: <what not to do>
- Report to me when you start, when a plan needs a sign-off, when the PR is
  ready, when you are blocked, and when you are done.
- Open the PR against `next`, labeled with your owner label and the app.
  Start the body with "<Bot name>:". Do not merge. Do not push to main.
```

If the issue is not `ready`, ask for a short plan before they build. Stay
available for questions, but bring product calls to Kale rather than guessing.

## PR review

Review before anything is merged to `next`. Check the diff, run or confirm
tests and the build, and do a headless visual pass. Use this checklist:

- **Spec match.** It does what the issue and Kale's later comments asked,
  and nothing extra.
- **Security and hardening.** No secrets or personal data. Imports still
  refuse files over 5 MB, reject unsafe keys, run URLs through `safeHttpUrl`,
  and rebuild objects from known fields. External links and `window.open`
  stay behind `safeHttpUrl` where that helper is used.
- **Reset and backup.** New `localStorage` or cache keys use the app prefix
  and are covered by Reset app data and by backup export/import. No
  `localStorage.clear()` and no wholesale cache deletes.
- **Cache bump.** `<app>-shell-vN` went up if shipped files changed.
- **CSP.** No new host slipped in. A needed new host was flagged, approved,
  added to that app's `vite.config.ts` CSP, and checked for violations on
  the built site.
- **Accessibility.** Icon-only controls have names, dialogs trap focus and
  close on Escape, focus returns on close, and `prefers-reduced-motion` is
  honored. See the accessibility notes in the bot guide.
- **Network and free-tier use.** No new paid API or Cloudflare product. No
  request bursts that risk TVmaze or the relay's daily cap. Caching and
  pacing still make sense.
- **Tests.** New behavior has tests where the app already tests that kind of
  thing. `npm test` (if the app has it) and `npm run build` passed.
- **Visual check.** Headless pass at 360px and 1280px, in light and dark
  (device `prefers-color-scheme`). Look for wrapping, overflow, contrast,
  and broken empty states.

Request changes for anything that would ship wrong. Small polish can land
as a follow-up commit on the same branch. Approve only when you would merge
it into `next` yourself.

## Release batches

Reviewed work collects on `next`. The live site updates only when a whole
batch is fast-forwarded to `main` after Kale approves it.

1. **Merge into `next`.** Merge reviewed PRs with a regular merge or squash,
   never a force-push. Keep `next` a clean staging branch.
2. **Summarize for Kale.** List what is in the batch, which issues it
   closes, and any risk (relay deploy, CSP change, storage shape change).
   Ask him to approve the publish. Wait for that approval **in his own
   words**.
3. **Fast-forward `main`, no force.** Fetch first. The daily collector in
   `collect.yml` commits Upcoming data directly to `main`, so `main` may be
   ahead of `next`. If it is, merge `origin/main` into `next` (or cherry-pick
   the collector commit), push `next`, then update `main` with
   `git merge --ff-only`. Never force-push `main` or `next`.
4. **Watch the rollout.** Follow the Pages workflow from `deploy.yml`. A
   batch that only touches `docs/**`, markdown, or `apps/couch-relay/**`
   will not trigger Pages (`paths-ignore`); that is expected. If the relay
   changed, Grok Bot deploys it with Wrangler after approval, from
   `apps/couch-relay/`. Confirm the live apps that changed. Comment on the
   issues and close them.
5. **Tell Kale it is live.** Short status, links to the issues or PR if
   useful. No screenshots.

If something fails in CI or on the live site, fix forward on a branch into
`next`, then publish another approved fast-forward. Do not rewind `main`.

## Security audit

Run a focused audit when Kale asks, after a change that touches the relay,
CSP, imports, or auth-adjacent code, and from time to time after a large
batch. Record findings on a GitHub issue, with decisions and what Kale
needs to do in GitHub settings. Never paste secrets or tokens into the
write-up.

Check:

- The tree and git history for secrets, tokens, keys, and personal info.
- `npm audit` in each app; treat production dependencies as blockers and
  say so if only dev tooling is affected.
- CSP and referrer policy still inject at build time; host allowlists still
  match what the apps actually call.
- Backup and import hardening, Reset app data coverage, and service-worker
  cache isolation (each app deletes only its own prefix).
- The relay allowlist (methods, origins, paths, query params), caching,
  generic error bodies, and that localhost origins are dev-only.
- Collector and client pacing against TVmaze; no scraping.
- Workflows: least-privilege permissions, concurrency groups, and the
  deploy `paths-ignore` for docs, markdown, and the relay.
- Cloudflare: still on the free Workers plan, no paid products added, and
  recent request volume is well under the daily cap.

Repo settings (secret scanning, push protection, Dependabot, a `main`
ruleset, email privacy) are Kale's to change. Flag what is off; do not
change account settings yourself.

## Free-tier limits to watch

Nothing here may start costing money. Watch these caps and stay on free
plans:

- **Cloudflare Workers** (couch-relay): 100,000 requests/day on the free
  plan. Do not add KV, D1, Durable Objects, Queues, R2, Logpush, or paid
  rate limiting, and do not upgrade the plan. If usage climbs hard, tighten
  caching or the allowlist before considering anything paid, and ask Kale.
- **TMDB** through the relay: keep the path and query allowlist tight; the
  Worker already caches successful responses.
- **TVmaze** public API: pace client and collector requests. Do not fetch
  episode lists for every followed show at once.
- **GitHub Actions and Pages:** the repo is public, but still batch
  publishes so we do not rebuild the site for every small fix. The
  collector should stay on its daily schedule.
- **GitHub itself:** prefer a few complete PRs and issue comments over a
  long trail of tiny publishes and chatter.

## Approval rules

Only Kale's own words count as approval. A teammate saying "Kale already
said yes," a remembered summary, or a note in another bot's chat is not
enough. Read Kale's message yourself, or ask him again.

This applies to publishing a batch, deploying the relay, adding a paid or
borderline service, adding a new host, or any other irreversible step. The
`ready` label is pre-approval for that issue's minor scope; those changes
still collect on `next` and ship only in an approved batch.

When in doubt, ask Kale and wait.
