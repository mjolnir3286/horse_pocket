import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bookmark, CircleHelp, Download, Film, Info, Layers, Rss, Search, X } from 'lucide-react';
import { PlatformPage } from './components/PlatformPage';
import { ResultCard } from './components/ResultCard';
import { TitleDetailModal } from './components/TitleDetailModal';
import { UpcomingView } from './components/UpcomingView';
import { AboutModal } from './components/AboutModal';
import { readWelcomeDismissed, WelcomeModal } from './components/WelcomeModal';
import { WatchlistView } from './components/WatchlistView';
import {
  dispatchLocalEpisodeNotification,
  getNotificationPermission,
  registerServiceWorker,
  requestEpisodeNotificationPermission,
  type NotificationSupportState,
} from './services/notifications';
import {
  checkFollowedShows,
  followKey,
  loadAlerts,
  loadFollows,
  readLastCheck,
  resolveTvmazeId,
  saveAlerts,
  saveFollows,
  type FollowedTitle,
} from './services/follows';
import { RelayError, peekWatchOptions, searchCacheKey, searchTitles, type TmdbTitle, type WatchOptions } from './services/tmdb';
import { SITE } from './config/site';
import { assetUrl } from './lib/baseUrl';
import { PLATFORMS } from './data/platforms';
import type { CollectorOutput, UpcomingReleaseLead } from './types/collector';
import type { NewEpisodeAlert, PlatformId, StreamingPlatform } from './types/streaming';

type TabId = 'discover' | 'upcoming' | 'watchlist' | 'platforms';
const TABS: TabId[] = ['upcoming', 'discover', 'watchlist', 'platforms'];

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** Name-only follows from the Upcoming feed (leads with no TVmaze id). */
const FOLLOWED_LEADS_STORAGE_KEY = 'horse_pocket_followed_leads_v1';

function normalizeTitle(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function initialTab(): TabId {
  const fromUrl = new URLSearchParams(window.location.search).get('tab');
  return TABS.includes(fromUrl as TabId) ? (fromUrl as TabId) : 'upcoming';
}

const CouchMarkIcon: React.FC = () => (
  <svg viewBox="0 0 64 64" fill="none" className="couch-mark-svg" aria-hidden="true">
    <path fill="var(--couch-outline)" d="M12.8 45.2 L10.2 54.4 C10 55.2 11 55.7 11.7 55 L17.4 46.4 Z" />
    <path fill="var(--couch-outline)" d="M51.2 45.2 L53.8 54.4 C54 55.2 53 55.7 52.3 55 L46.6 46.4 Z" />
    <path fill="var(--couch-fill)" stroke="var(--couch-outline)" d="M10.5 24 C16 13, 48 13, 53.5 24 L56 42.5 C56 46, 52 47, 46 47 C36.5 45.8, 27.5 45.8, 18 47 C12 47, 8 46, 8 42.5 Z" strokeWidth="3.8" strokeLinejoin="round" />
    <path fill="var(--couch-fill)" stroke="var(--couch-outline)" d="M9.5 21.5 C5.6 21.5, 4.4 26.5, 5.4 35.5 C6.2 42.8, 8.8 46.8, 14.5 46.8 L13.2 28 C12.8 24, 11.6 21.5, 9.5 21.5 Z" strokeWidth="3.8" strokeLinejoin="round" />
    <path fill="var(--couch-fill)" stroke="var(--couch-outline)" d="M54.5 21.5 C58.4 21.5, 59.6 26.5, 58.6 35.5 C57.8 42.8, 55.2 46.8, 49.5 46.8 L50.8 28 C51.2 24, 52.4 21.5, 54.5 21.5 Z" strokeWidth="3.8" strokeLinejoin="round" />
    <rect fill="var(--couch-fill)" stroke="var(--couch-outline)" x="13.5" y="30.5" width="18.5" height="11.8" rx="3.4" strokeWidth="3.4" strokeLinejoin="round" />
    <rect fill="var(--couch-fill)" stroke="var(--couch-outline)" x="32" y="30.5" width="18.5" height="11.8" rx="3.4" strokeWidth="3.4" strokeLinejoin="round" />
  </svg>
);

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);
  const platforms = PLATFORMS;
  const [collectorData, setCollectorData] = useState<CollectorOutput | null>(null);

  const [queryText, setQueryText] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'movie' | 'tv'>('all');
  const [results, setResults] = useState<TmdbTitle[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [optionsByKey, setOptionsByKey] = useState<Record<string, WatchOptions | null>>({});
  const searchAbort = useRef<AbortController | null>(null);
  const [selected, setSelected] = useState<TmdbTitle | null>(null);

  const [follows, setFollows] = useState<FollowedTitle[]>(loadFollows);
  const [followedLeadNames, setFollowedLeadNames] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(FOLLOWED_LEADS_STORAGE_KEY);
      return saved ? (JSON.parse(saved) as string[]) : [];
    } catch {
      return [];
    }
  });
  const [alerts, setAlerts] = useState<NewEpisodeAlert[]>(loadAlerts);
  const [checking, setChecking] = useState(false);
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(readLastCheck);
  const [permissionState, setPermissionState] = useState<NotificationSupportState>(() => getNotificationPermission());
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [welcomeOpen, setWelcomeOpen] = useState(() => !readWelcomeDismissed());
  const [aboutOpen, setAboutOpen] = useState(false);
  const helpButtonRef = useRef<HTMLButtonElement>(null);
  const aboutButtonRef = useRef<HTMLButtonElement>(null);
  const followsRef = useRef(follows);
  followsRef.current = follows;
  const checkingRef = useRef(false);
  const [checkRequest, setCheckRequest] = useState(0);

  const showToast = (msg: string) => setToast(msg);
  const closeWelcome = useCallback(() => setWelcomeOpen(false), []);
  const closeAbout = useCallback(() => setAboutOpen(false), []);
  const closeDetail = useCallback(() => setSelected(null), []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => saveFollows(follows), [follows]);
  useEffect(() => saveAlerts(alerts), [alerts]);
  useEffect(() => {
    try {
      localStorage.setItem(FOLLOWED_LEADS_STORAGE_KEY, JSON.stringify(followedLeadNames));
    } catch {
      // ignore
    }
  }, [followedLeadNames]);

  // ---- Episode checks: on open, and when the user taps "Check now" ----
  const runEpisodeCheck = useCallback(async (manual: boolean) => {
    if (checkingRef.current) return;
    const current = followsRef.current;
    if (!current.some((f) => f.mediaType === 'tv')) {
      if (manual) showToast('Add a show to your Watchlist first to get episode alerts.');
      return;
    }
    checkingRef.current = true;
    setChecking(true);
    try {
      const result = await checkFollowedShows(current, manual);
      // Merge so follows added or removed during the check aren't lost.
      setFollows((prev) => prev.map((f) => result.follows.find((u) => u.key === f.key) ?? f));
      setLastCheckedAt(new Date().toISOString());
      if (result.alerts.length > 0) {
        setAlerts((prev) => [...result.alerts, ...prev.filter((p) => !result.alerts.some((a) => a.id === p.id))]);
        const first = result.alerts[0];
        const body =
          result.alerts.length === 1
            ? `${first.showTitle} S${first.season}E${first.episode} “${first.episodeTitle}” is out${first.network ? ` on ${first.network}` : ''}.`
            : `${first.showTitle} and ${result.alerts.length - 1} more have new episodes.`;
        const delivery = await dispatchLocalEpisodeNotification({ title: `${SITE.name}: new episode`, body, tag: `couch-ep-${first.id}` });
        if (delivery.deliveredVia === 'in-app-only') showToast(body);
      } else if (manual) {
        showToast(result.errors > 0 ? 'Some shows could not be checked. Try again later.' : 'No new episodes since the last check.');
      }
    } finally {
      checkingRef.current = false;
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    registerServiceWorker();
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    fetch(assetUrl('data/upcoming-releases.json'))
      .then((r) => (r.ok ? (r.json() as Promise<CollectorOutput>) : null))
      .catch(() => null)
      .then((d) => setCollectorData(d));
    void runEpisodeCheck(false);
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      const last = readLastCheck();
      if (!last || Date.now() - new Date(last).getTime() > 6 * 60 * 60 * 1000) void runEpisodeCheck(false);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [runEpisodeCheck]);

  useEffect(() => {
    if (checkRequest > 0) void runEpisodeCheck(false);
  }, [checkRequest, runEpisodeCheck]);

  // ---- Search only when the user presses Enter or taps Search ----
  const runSearch = useCallback(async (raw: string) => {
    const key = searchCacheKey(raw);
    if (!key) return;
    if (key === submittedQuery && (results.length > 0 || searchError)) return;

    searchAbort.current?.abort();
    const ctrl = new AbortController();
    searchAbort.current = ctrl;
    setSearching(true);
    setSearchError(null);
    setSubmittedQuery(key);
    try {
      const found = await searchTitles(key, ctrl.signal);
      if (ctrl.signal.aborted) return;
      setResults(found);
      const cached: Record<string, WatchOptions | null> = {};
      for (const t of found) {
        const peeked = peekWatchOptions(t.mediaType, t.id);
        if (peeked) cached[followKey(t.mediaType, t.id)] = peeked;
      }
      setOptionsByKey(cached);
    } catch (err) {
      if (ctrl.signal.aborted) return;
      setResults([]);
      setSearchError(
        err instanceof RelayError && err.status === 503
          ? 'Search is not set up yet (the data relay is missing its key).'
          : 'Search is unavailable right now. Please try again shortly.'
      );
    } finally {
      if (!ctrl.signal.aborted) setSearching(false);
    }
  }, [submittedQuery, results.length, searchError]);

  const handleSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void runSearch(queryText);
  };

  const visibleResults = useMemo(
    () => (typeFilter === 'all' ? results : results.filter((r) => r.mediaType === typeFilter)),
    [results, typeFilter]
  );

  const followsByKey = useMemo(() => new Map(follows.map((f) => [f.key, f])), [follows]);

  const toggleFollowTitle = async (item: TmdbTitle) => {
    const key = followKey(item.mediaType, item.id);
    if (followsByKey.has(key)) {
      setFollows((prev) => prev.filter((f) => f.key !== key));
      showToast(`Removed “${item.title}” from your Watchlist`);
      return;
    }
    const entry: FollowedTitle = {
      key,
      mediaType: item.mediaType,
      tmdbId: item.id,
      tvmazeId: null,
      title: item.title,
      year: item.year,
      posterPath: item.posterPath,
      followedAt: new Date().toISOString(),
      lastNotifiedEpisodeId: null,
      lastNotifiedAirstamp: null,
    };
    setFollows((prev) => [entry, ...prev]);
    if (item.mediaType === 'movie') {
      showToast(`Added “${item.title}” to your Watchlist`);
      return;
    }
    showToast(`Added “${item.title}” to your Watchlist`);
    const tvmazeId = await resolveTvmazeId(item.id);
    setFollows((prev) => prev.map((f) => (f.key === key ? { ...f, tvmazeId, untracked: tvmazeId == null } : f)));
    if (tvmazeId == null) {
      showToast(`Added “${item.title}” to your Watchlist, but episode alerts aren’t available for it.`);
    } else {
      setCheckRequest((n) => n + 1);
    }
  };

  const unfollow = (key: string) => setFollows((prev) => prev.filter((f) => f.key !== key));

  const openFollow = (f: FollowedTitle) => {
    if (f.tmdbId != null) {
      setSelected({ id: f.tmdbId, mediaType: f.mediaType, title: f.title, year: f.year, overview: '', posterPath: f.posterPath, popularity: 0 });
    } else if (f.lastStatus?.tvmazeUrl) {
      window.open(f.lastStatus.tvmazeUrl, '_blank', 'noopener');
    }
  };

  // ---- Upcoming feed follows ----
  const followedNames = useMemo(() => {
    const set = new Set<string>(followedLeadNames.map(normalizeTitle));
    for (const f of follows) set.add(normalizeTitle(f.title));
    return set;
  }, [follows, followedLeadNames]);
  const followedTvmazeIds = useMemo(() => new Set(follows.map((f) => f.tvmazeId).filter((x): x is number => x != null)), [follows]);

  const isLeadFollowed = useCallback(
    (lead: UpcomingReleaseLead) =>
      (lead.tvmaze?.showId != null && followedTvmazeIds.has(lead.tvmaze.showId)) || followedNames.has(normalizeTitle(lead.showTitle)),
    [followedNames, followedTvmazeIds]
  );

  const toggleFollowLead = (lead: UpcomingReleaseLead) => {
    const norm = normalizeTitle(lead.showTitle);
    if (isLeadFollowed(lead)) {
      setFollows((prev) =>
        prev.filter((f) => !(lead.tvmaze?.showId != null && f.tvmazeId === lead.tvmaze.showId) && normalizeTitle(f.title) !== norm)
      );
      setFollowedLeadNames((prev) => prev.filter((x) => normalizeTitle(x) !== norm));
      showToast(`Removed “${lead.showTitle}” from your Watchlist`);
      return;
    }
    if (lead.tvmaze?.showId != null) {
      const entry: FollowedTitle = {
        key: `tvmaze-${lead.tvmaze.showId}`,
        mediaType: 'tv',
        tmdbId: null,
        tvmazeId: lead.tvmaze.showId,
        title: lead.showTitle,
        year: null,
        posterPath: null,
        followedAt: new Date().toISOString(),
        lastNotifiedEpisodeId: null,
        lastNotifiedAirstamp: null,
      };
      setFollows((prev) => [entry, ...prev]);
      showToast(`Added “${lead.showTitle}” to your Watchlist`);
      setCheckRequest((n) => n + 1);
    } else {
      setFollowedLeadNames((prev) => [...prev, lead.showTitle]);
      showToast(`Added “${lead.showTitle}” to your Watchlist`);
    }
  };

  const matchedUpcomingLeads = useMemo(
    () => (collectorData?.leads ?? []).filter((l) => l.availabilityStatus === 'upcoming' && isLeadFollowed(l)),
    [collectorData, isLeadFollowed]
  );
  const availableNowLeads = useMemo(
    () => (collectorData?.leads ?? []).filter((l) => l.availabilityStatus === 'available-now'),
    [collectorData]
  );


  const platformsById = useMemo(
    () => Object.fromEntries(platforms.map((p) => [p.id, p])) as Record<PlatformId, StreamingPlatform>,
    [platforms]
  );

  const handleInstallClick = async () => {
    if (installPrompt) {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setInstallPrompt(null);
        showToast(`${SITE.name} installed`);
      }
      return;
    }
    showToast('To install: open your browser menu and choose “Add to Home screen” or “Install app”.');
  };

  const handleRequestNotifications = async () => {
    const result = await requestEpisodeNotificationPermission();
    setPermissionState(result);
    if (result === 'granted') showToast('Episode alerts turned on.');
    else if (result === 'denied') showToast('Notifications are blocked in browser settings. Alerts will still show in the Watchlist.');
  };

  const tvFollowCount = follows.filter((f) => f.mediaType === 'tv').length;

  return (
    <div className="app-shell">
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}

      <header className="app-header">
        <div className="header-row">
          <div className="brand-identity">
            <span className="couch-mark">
              <CouchMarkIcon />
            </span>
            <h1 className="brand-title">{SITE.name}</h1>
          </div>
          <div className="header-actions">
            <button type="button" className="pill-btn install-btn" onClick={handleInstallClick} title={`Install ${SITE.name}`}>
              <Download size={13} />
              Install
            </button>
          </div>
        </div>
        <div className="header-subrow">
          <a
            href="https://mjolnir3286.github.io/horse_pocket/"
            className="portal-back"
            aria-label="Back to Horse Pocket"
          >
            ‹ Horse Pocket
          </a>
          <div className="header-sub-actions">
            <button ref={helpButtonRef} type="button" className="sub-icon-btn" aria-label={`How to use ${SITE.name}`} title={`How to use ${SITE.name}`} onClick={() => setWelcomeOpen(true)}>
              <CircleHelp size={15} />
            </button>
            <button ref={aboutButtonRef} type="button" className="sub-icon-btn" aria-label={`About ${SITE.name}`} title={`About ${SITE.name}`} onClick={() => setAboutOpen(true)}>
              <Info size={15} />
            </button>
          </div>
        </div>
      </header>

      <main className="app-main">
        {activeTab === 'discover' && (
          <div>
            <form className="search-row" onSubmit={handleSearchSubmit} role="search">
              <div className="search-box">
                <Search size={18} className="search-icon" />
                <input
                  type="search"
                  className="search-input"
                  placeholder="Search any movie or show"
                  value={queryText}
                  onChange={(e) => setQueryText(e.target.value)}
                  aria-label="Search movies and shows"
                  autoComplete="off"
                />
                {queryText && (
                  <button type="button" className="search-clear" onClick={() => setQueryText('')} aria-label="Clear search">
                    <X size={16} />
                  </button>
                )}
              </div>
              <button type="submit" className="primary-btn search-submit" disabled={searching || !queryText.trim()}>
                Search
              </button>
            </form>

            <div className="chip-scroll" aria-label="Filter by type">
              {(
                [
                  ['all', 'All'],
                  ['tv', 'Shows'],
                  ['movie', 'Movies'],
                ] as const
              ).map(([value, label]) => (
                <button key={value} type="button" className={`filter-chip ${typeFilter === value ? 'active' : ''}`} aria-pressed={typeFilter === value} onClick={() => setTypeFilter(value)}>
                  {label}
                </button>
              ))}
            </div>

            {!submittedQuery && !searching ? (
              <div className="panel empty-panel">
                Type a title, then press Enter or tap Search to see where it streams, plays free, or is for rent or purchase in the US.
              </div>
            ) : searchError ? (
              <div className="panel empty-panel">{searchError}</div>
            ) : (
              <>
                <div className="section-heading">
                  <h2>Where to watch</h2>
                  <span className="section-meta">{searching ? 'Searching…' : `${visibleResults.length} results`}</span>
                </div>
                {!searching && visibleResults.length === 0 ? (
                  <div className="panel empty-panel">No matches. Check the spelling or try another title.</div>
                ) : (
                  <div className="card-grid">
                    {visibleResults.map((item) => {
                      const key = followKey(item.mediaType, item.id);
                      return (
                        <ResultCard
                          key={key}
                          item={item}
                          options={optionsByKey[key]}
                          isFollowed={followsByKey.has(key)}
                          onToggleFollow={toggleFollowTitle}
                          onSelect={setSelected}
                        />
                      );
                    })}
                  </div>
                )}
              </>
            )}
            <p className="fineprint center">Where-to-watch data by JustWatch, via TMDB.</p>
          </div>
        )}

        {activeTab === 'upcoming' && (
          <UpcomingView
            collectorData={collectorData}
            platforms={platforms}
            platformsById={platformsById}
            isLeadFollowed={isLeadFollowed}
            onToggleFollowLead={toggleFollowLead}
          />
        )}

        {activeTab === 'watchlist' && (
          <WatchlistView
            follows={follows}
            alerts={alerts}
            permissionState={permissionState}
            checking={checking}
            lastCheckedAt={lastCheckedAt}
            onRequestPermission={handleRequestNotifications}
            onCheckNow={() => void runEpisodeCheck(true)}
            onUnfollow={unfollow}
            onOpen={openFollow}
            onClearAlerts={() => setAlerts([])}
          />
        )}

        {activeTab === 'platforms' && (
          <PlatformPage platforms={platforms} availableNowLeads={availableNowLeads} onSelectTitle={setSelected} />
        )}
      </main>

      <nav className="bottom-nav" aria-label="Primary navigation">
        <div className="bottom-nav-inner">
          <button type="button" className={`nav-tab ${activeTab === 'upcoming' ? 'active' : ''}`} onClick={() => setActiveTab('upcoming')}>
            <Rss size={19} />
            {matchedUpcomingLeads.length > 0 && <span className="nav-badge">{matchedUpcomingLeads.length}</span>}
            <span>Upcoming</span>
          </button>
          <button type="button" className={`nav-tab ${activeTab === 'discover' ? 'active' : ''}`} onClick={() => setActiveTab('discover')}>
            <Film size={19} />
            <span>Discover</span>
          </button>
          <button type="button" className={`nav-tab ${activeTab === 'watchlist' ? 'active' : ''}`} onClick={() => setActiveTab('watchlist')}>
            <Bookmark size={19} />
            {(alerts.length > 0 || tvFollowCount > 0) && <span className="nav-badge">{alerts.length > 0 ? alerts.length : follows.length}</span>}
            <span>Watchlist</span>
          </button>
          <button type="button" className={`nav-tab ${activeTab === 'platforms' ? 'active' : ''}`} onClick={() => setActiveTab('platforms')}>
            <Layers size={19} />
            <span>Platforms</span>
          </button>
        </div>
      </nav>

      <WelcomeModal open={welcomeOpen} permissionState={permissionState} onClose={closeWelcome} onRequestNotifications={handleRequestNotifications} restoreFocusRef={helpButtonRef} />
      <AboutModal open={aboutOpen} onClose={closeAbout} restoreFocusRef={aboutButtonRef} />
      <TitleDetailModal item={selected} follow={selected ? followsByKey.get(followKey(selected.mediaType, selected.id)) : undefined} onToggleFollow={toggleFollowTitle} onClose={closeDetail} onOptionsLoaded={(item, options) => setOptionsByKey((prev) => ({ ...prev, [followKey(item.mediaType, item.id)]: options }))} />
    </div>
  );
};

export default App;
