/**
 * Headless UI checks for issue #9 (Hide watched on Watchlist, Watch Next filtering).
 * Expects a preview server at BASE (default http://127.0.0.1:4173/horse_pocket/couch/).
 */
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';

const BASE = process.env.COUCH_BASE || 'http://127.0.0.1:4173/horse_pocket/couch/';
const CHROME = process.env.CHROME || '/usr/bin/google-chrome-stable';

const YESTERDAY = '2026-01-15';
const LAST_YEAR = '2025-06-01';
const FUTURE = '2099-01-15';

const FOLLOWS = [
  {
    key: 'movie-101',
    mediaType: 'movie',
    tmdbId: 101,
    tvmazeId: null,
    title: 'Test Movie',
    year: '2024',
    posterPath: null,
    followedAt: '2026-01-01T00:00:00.000Z',
    lastNotifiedEpisodeId: null,
    lastNotifiedAirstamp: null,
  },
  {
    key: 'tv-201',
    mediaType: 'tv',
    tmdbId: 201,
    tvmazeId: 900201,
    title: 'Caught Up Show',
    year: '2023',
    posterPath: null,
    followedAt: '2026-01-01T00:00:00.000Z',
    lastNotifiedEpisodeId: null,
    lastNotifiedAirstamp: null,
    lastStatus: {
      checkedAt: '2026-11-01T00:00:00.000Z',
      network: 'TestNet',
      showStatus: 'Running',
      tvmazeUrl: 'https://example.test/caught',
      previous: { id: 2011, season: 1, number: 8, name: 'Old', airdate: LAST_YEAR, airstamp: `${LAST_YEAR}T20:00:00.000Z` },
      next: { id: 2012, season: 1, number: 9, name: 'Soon', airdate: FUTURE, airstamp: `${FUTURE}T20:00:00.000Z` },
    },
  },
  {
    key: 'tv-301',
    mediaType: 'tv',
    tmdbId: 301,
    tvmazeId: 900301,
    title: 'New Episode Show',
    year: '2023',
    posterPath: null,
    followedAt: '2026-01-01T00:00:00.000Z',
    lastNotifiedEpisodeId: null,
    lastNotifiedAirstamp: null,
    lastStatus: {
      checkedAt: '2026-11-01T00:00:00.000Z',
      network: 'TestNet',
      showStatus: 'Running',
      tvmazeUrl: 'https://example.test/newep',
      previous: { id: 3012, season: 2, number: 1, name: 'New', airdate: YESTERDAY, airstamp: `${YESTERDAY}T20:00:00.000Z` },
      next: { id: 3013, season: 2, number: 2, name: 'Later', airdate: FUTURE, airstamp: `${FUTURE}T20:00:00.000Z` },
    },
  },
  {
    key: 'tv-401',
    mediaType: 'tv',
    tmdbId: 401,
    tvmazeId: 900401,
    title: 'Partial Ticks Show',
    year: '2022',
    posterPath: null,
    followedAt: '2026-01-01T00:00:00.000Z',
    lastNotifiedEpisodeId: null,
    lastNotifiedAirstamp: null,
    lastStatus: {
      checkedAt: '2026-11-01T00:00:00.000Z',
      network: 'TestNet',
      showStatus: 'Running',
      tvmazeUrl: 'https://example.test/partial',
      previous: { id: 4012, season: 1, number: 2, name: 'Two', airdate: YESTERDAY, airstamp: `${YESTERDAY}T20:00:00.000Z` },
      next: { id: 4013, season: 1, number: 3, name: 'Three', airdate: FUTURE, airstamp: `${FUTURE}T20:00:00.000Z` },
    },
  },
];

const WATCHED = {
  'movie-101': {
    key: 'movie-101',
    mediaType: 'movie',
    tmdbId: 101,
    tvmazeId: null,
    title: 'Test Movie',
    year: '2024',
    posterPath: null,
    allAiredAt: '2026-02-01T00:00:00.000Z',
    episodes: {},
    updatedAt: '2026-02-01T00:00:00.000Z',
  },
  'tv-201': {
    key: 'tv-201',
    mediaType: 'tv',
    tmdbId: 201,
    tvmazeId: 900201,
    title: 'Caught Up Show',
    year: '2023',
    posterPath: null,
    allAiredAt: '2026-01-01T00:00:00.000Z',
    episodes: {},
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  'tv-301': {
    key: 'tv-301',
    mediaType: 'tv',
    tmdbId: 301,
    tvmazeId: 900301,
    title: 'New Episode Show',
    year: '2023',
    posterPath: null,
    allAiredAt: '2025-12-01T00:00:00.000Z',
    episodes: {},
    updatedAt: '2025-12-01T00:00:00.000Z',
  },
  'tv-401': {
    key: 'tv-401',
    mediaType: 'tv',
    tmdbId: 401,
    tvmazeId: 900401,
    title: 'Partial Ticks Show',
    year: '2022',
    posterPath: null,
    allAiredAt: null,
    episodes: { '4011': true },
    updatedAt: '2026-01-20T00:00:00.000Z',
  },
};

const recEntry = (value) => ({ expires: Date.now() + 24 * 60 * 60 * 1000, value });
const RECS = {
  'movie-101': recEntry([
    { id: 201, mediaType: 'tv', title: 'Caught Up Show', year: '2023', overview: '', posterPath: null, popularity: 10 },
    { id: 999, mediaType: 'tv', title: 'Fresh Suggestion', year: '2026', overview: '', posterPath: null, popularity: 9 },
  ]),
  // Empty cached lists so Watch Next does not call the live relay for other seeds.
  'tv-201': recEntry([]),
  'tv-301': recEntry([]),
  'tv-401': recEntry([]),
};

async function openWatchlist(page) {
  const clicked = await page.evaluate(() => {
    const tabs = [...document.querySelectorAll('.nav-tab')];
    const tab = tabs.find((el) => /watchlist/i.test(el.textContent || ''));
    if (!tab) return false;
    tab.click();
    return true;
  });
  if (!clicked) throw new Error('Watchlist tab not found');
  await page.waitForFunction(() => {
    const current = document.querySelector('.nav-tab[aria-current="page"]');
    return current && /watchlist/i.test(current.textContent || '');
  }, { timeout: 5000 });
}

async function fixture({ hide = false, onlyCaughtUp = false } = {}) {
  const follows = onlyCaughtUp ? FOLLOWS.filter((f) => f.key === 'movie-101' || f.key === 'tv-201') : FOLLOWS;
  const watched = onlyCaughtUp
    ? { 'movie-101': WATCHED['movie-101'], 'tv-201': WATCHED['tv-201'] }
    : WATCHED;
  return { follows, watched, hide, recs: RECS };
}

async function openSeeded(browser, width, height, opts = {}) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewport({ width, height, deviceScaleFactor: 1, hasTouch: width < 768, isMobile: width < 768 });
  await page.setBypassServiceWorker(true);
  const payload = await fixture(opts);
  await page.evaluateOnNewDocument((payload) => {
    localStorage.clear();
    localStorage.setItem('horse_pocket_welcome_dismissed_v1', 'true');
    localStorage.setItem('couch_follows_v1', JSON.stringify(payload.follows));
    localStorage.setItem('couch_watched_v1', JSON.stringify(payload.watched));
    localStorage.setItem('couch_tmdb_recommendations_v1', JSON.stringify(payload.recs));
    if (payload.hide) localStorage.setItem('couch_hide_watched_v1', 'true');
    else localStorage.removeItem('couch_hide_watched_v1');
  }, payload);
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('.nav-tab', { timeout: 15000 });
  await openWatchlist(page);
  page.__pageerrors = errors;
  return page;
}

function titles(page) {
  return page.evaluate(() => [...document.querySelectorAll('.watch-row[data-title]')].map((el) => el.getAttribute('data-title')));
}

async function runViewport(browser, width, height) {
  let page = await openSeeded(browser, width, height, { hide: false });

  const toggle = await page.waitForSelector('.watchlist-heading .watched-toggle', { timeout: 10000 });
  const startLabel = await toggle.evaluate((el) => el.getAttribute('aria-label'));
  assert.equal(startLabel, 'Hide watched', `${width}px: toggle should start off`);
  const before = await titles(page);
  assert.deepEqual(
    [...before].sort(),
    ['Caught Up Show', 'New Episode Show', 'Partial Ticks Show', 'Test Movie'].sort(),
    `${width}px: all titles visible when toggle is off`
  );

  await toggle.click();
  await page.waitForFunction(() => document.querySelector('.watchlist-heading .watched-toggle')?.getAttribute('aria-label') === 'Show watched');
  const hidden = await titles(page);
  assert.ok(!hidden.includes('Test Movie'), `${width}px: watched movie should hide`);
  assert.ok(!hidden.includes('Caught Up Show'), `${width}px: caught-up show should hide`);
  assert.ok(hidden.includes('New Episode Show'), `${width}px: show with a new episode after the mark should stay`);
  assert.ok(hidden.includes('Partial Ticks Show'), `${width}px: show with partial ticks should stay`);

  const hideFlag = await page.evaluate(() => localStorage.getItem('couch_hide_watched_v1'));
  assert.equal(hideFlag, 'true', `${width}px: hide setting is saved`);

  const heading = await page.$('.watch-next-toggle, #watch-next-heading');
  assert.ok(heading, `${width}px: Watch Next heading present`);
  const expanded = await page.$eval('.watch-next-toggle', (el) => el.getAttribute('aria-expanded')).catch(() => null);
  if (expanded === 'false') await page.click('.watch-next-toggle');
  await page.waitForSelector('.watch-next-row, .watch-next .empty-panel, .watch-next-load', { timeout: 8000 });
  const nextText = await page.$eval('.watch-next', (el) => el.innerText);
  const cardTitles = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('.watch-next-row .watch-next-card')];
    return cards.map((c) => ({
      text: (c.querySelector('.watch-next-title')?.textContent || '').trim(),
      note: (c.querySelector('.watch-next-because')?.textContent || '').trim(),
    }));
  });
  const listed = cardTitles.map((c) => c.text);
  assert.ok(
    listed.some((t) => t.includes('Fresh Suggestion')),
    `${width}px: Watch Next should list Fresh Suggestion, got ${JSON.stringify(cardTitles)} / ${nextText.slice(0, 200)}`
  );
  assert.ok(
    !listed.some((t) => t === 'Caught Up Show'),
    `${width}px: Watch Next must not list the caught-up show, got ${JSON.stringify(cardTitles)}`
  );
  assert.ok(
    cardTitles.some((c) => /Similar to Test Movie/.test(c.note)) || /Similar to Test Movie/.test(nextText),
    `${width}px: Similar to seed may be a watched title`
  );

  await page.close();
  page = await openSeeded(browser, width, height, { hide: true, onlyCaughtUp: true });
  const empty = await page.$eval('.empty-panel', (el) => el.textContent.replace(/\s+/g, ' ').trim());
  // The Watchlist empty note, not the Watch Next empty panel
  const caughtUp = await page.evaluate(() => {
    const panels = [...document.querySelectorAll('.empty-panel')].map((el) => el.textContent.replace(/\s+/g, ' ').trim());
    return panels.find((t) => t.includes('All caught up')) || panels.join(' | ');
  });
  assert.match(caughtUp, /All caught up/, `${width}px: empty state should say All caught up, got "${caughtUp}" (all: "${empty}")`);
  assert.equal((await titles(page)).length, 0, `${width}px: no watch rows when everything is hidden`);
  const showBtn = await page.waitForSelector('.empty-panel .text-btn', { timeout: 5000 });
  const showLabel = await showBtn.evaluate((el) => el.textContent.trim());
  assert.equal(showLabel, 'Show watched');
  await showBtn.click();
  await page.waitForFunction(() => document.querySelectorAll('.watch-row[data-title]').length >= 2);
  const restored = await titles(page);
  assert.ok(restored.includes('Test Movie') && restored.includes('Caught Up Show'), `${width}px: Show watched restores the list, got ${restored}`);
  const toggleOff = await page.$eval('.watchlist-heading .watched-toggle', (el) => el.getAttribute('aria-label'));
  assert.equal(toggleOff, 'Hide watched', `${width}px: Show watched turns the toggle off`);

  await page.close();
  page = await openSeeded(browser, width, height, { hide: true });
  const remembered = await titles(page);
  assert.ok(!remembered.includes('Test Movie') && remembered.includes('New Episode Show'), `${width}px: remembered hide on load, got ${remembered}`);
  if (page.__pageerrors.length) throw new Error(`${width}px page errors: ${page.__pageerrors.join(' | ')}`);
  await page.close();
  console.log(`OK ${width}x${height}`);
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--hide-scrollbars'],
});
try {
  await runViewport(browser, 360, 780);
  await runViewport(browser, 1280, 800);
  console.log('all viewports passed');
} finally {
  await browser.close();
}
