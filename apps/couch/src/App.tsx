import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bookmark, Download, Film, Layers, Menu, Rss, Search, X } from 'lucide-react';
import { PlatformPage } from './components/PlatformPage';
import { ResultCard } from './components/ResultCard';
import { SideMenu, type PendingCouchImport } from './components/SideMenu';
import { TitleDetailModal, type DetailItem } from './components/TitleDetailModal';
import { HideWatchedToggle } from './components/HideWatchedToggle';
import { WatchNext } from './components/WatchNext';
import {
  findWatched,
  isTitleWatched,
  loadHideWatched,
  loadWatched,
  sanitizeWatched,
  saveHideWatched,
  saveWatched,
  setEpisodesWatched,
  setTitleWatched,
  watchedSources,
  type WatchedRef,
  type WatchedStore,
} from './services/watched';
import type { TvmazeEpisode } from './services/tvmaze';
import { UpcomingView } from './components/UpcomingView';
import { AboutModal } from './components/AboutModal';
import { readWelcomeDismissed, WelcomeModal } from './components/WelcomeModal';
import { WatchlistView } from './components/WatchlistView';
import {
  applyCouchBackupToStorage,
  buildCouchBackup,
  couchBackupFilename,
  downloadJsonFile,
  FOLLOWED_LEADS_STORAGE_KEY,
  parseCouchBackup,
  type DiscoverTypeFilter,
} from './services/backup';
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
  const [typeFilter, setTypeFilter] = useState<DiscoverTypeFilter>('all');
  const [results, setResults] = useState<TmdbTitle[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [optionsByKey, setOptionsByKey] = useState<Record<string, WatchOptions | null>>({});
  const searchAbort = useRef<AbortController | null>(null);
  const [selected, setSelected] = useState<DetailItem | null>(null);
  const [watched, setWatched] = useState<WatchedStore>(loadWatched);
  const [hideWatched, setHideWatched] = useState<boolean>(loadHideWatched);

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
  const [menuOpen, setMenuOpen] = useState(false);
  const [welcomeOpen, setWelcomeOpen] = useState(() => !readWelcomeDismissed());
  const [aboutOpen, setAboutOpen] = useState(false);
  const [backupGeneration, setBackupGeneration] = useState(0);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const followsRef = useRef(follows);
  followsRef.current = follows;
  const checkingRef = useRef(false);
  const [checkRequest, setCheckRequest] = useState(0);

  const showToast = (msg: string) => setToast(msg);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
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
  useEffect(() => saveWatched(watched), [watched]);
  useEffect(() => saveHideWatched(hideWatched), [hideWatched]);
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
    () =>
      results.filter(
        (r) =>
          (typeFilter === 'all' || r.mediaType === typeFilter) &&
          !(hideWatched && isTitleWatched(findWatched(watched, { key: followKey(r.mediaType, r.id), mediaType: r.mediaType, tmdbId: r.id })))
      ),
    [results, typeFilter, hideWatched, watched]
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
      setSelected({ id: f.tmdbId, mediaType: f.mediaType, title: f.title, year: f.year, overview: '', posterPath: f.posterPath, popularity: 0, tvmazeId: f.tvmazeId });
    } else if (f.tvmazeId != null) {
      setSelected({ id: 0, mediaType: 'tv', title: f.title, year: f.year, overview: '', posterPath: f.posterPath, popularity: 0, tvmazeId: f.tvmazeId, tmdbless: true });
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

  const addTvmazeFollow = (tvmazeId: number, title: string) => {
    const entry: FollowedTitle = {
      key: `tvmaze-${tvmazeId}`,
      mediaType: 'tv',
      tmdbId: null,
      tvmazeId,
      title,
      year: null,
      posterPath: null,
      followedAt: new Date().toISOString(),
      lastNotifiedEpisodeId: null,
      lastNotifiedAirstamp: null,
    };
    setFollows((prev) => (prev.some((f) => f.tvmazeId === tvmazeId) ? prev : [entry, ...prev]));
    showToast(`Added “${title}” to your Watchlist`);
    setCheckRequest((n) => n + 1);
  };

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
      addTvmazeFollow(lead.tvmaze.showId, lead.showTitle);
    } else {
      setFollowedLeadNames((prev) => [...prev, lead.showTitle]);
      showToast(`Added “${lead.showTitle}” to your Watchlist`);
    }
  };

  const matchedUpcomingLeads = useMemo(
    () => (collectorData?.leads ?? []).filter((l) => l.availabilityStatus === 'upcoming' && isLeadFollowed(l)),
    [collectorData, isLeadFollowed]
  );
  // ---- Watched marks (issue #1) ----
  const refForTitle = (item: DetailItem): WatchedRef =>
    item.tmdbless
      ? { key: `tvmaze-${item.tvmazeId}`, mediaType: 'tv', tmdbId: null, tvmazeId: item.tvmazeId ?? null, title: item.title, year: item.year, posterPath: item.posterPath }
      : {
          key: followKey(item.mediaType, item.id),
          mediaType: item.mediaType,
          tmdbId: item.id,
          tvmazeId: item.tvmazeId ?? followsByKey.get(followKey(item.mediaType, item.id))?.tvmazeId ?? null,
          title: item.title,
          year: item.year,
          posterPath: item.posterPath,
        };
  const refForLead = (lead: UpcomingReleaseLead): WatchedRef => ({
    key: lead.tvmaze?.showId != null ? `tvmaze-${lead.tvmaze.showId}` : `lead-${normalizeTitle(lead.showTitle)}`,
    mediaType: 'tv',
    tmdbId: null,
    tvmazeId: lead.tvmaze?.showId ?? null,
    title: lead.showTitle,
  });
  const refForFollow = (f: FollowedTitle): WatchedRef => ({
    key: f.key,
    mediaType: f.mediaType,
    tmdbId: f.tmdbId,
    tvmazeId: f.tvmazeId,
    title: f.title,
    year: f.year,
    posterPath: f.posterPath,
  });

  /** Shows found only through TVmaze get a TMDB id in the background so Watch Next can use them. */
  const enrichTmdbId = async (ref: WatchedRef) => {
    if (ref.mediaType !== 'tv' || ref.tmdbId != null) return;
    try {
      const found = await searchTitles(ref.title);
      const match = found.find((t) => t.mediaType === 'tv' && normalizeTitle(t.title) === normalizeTitle(ref.title));
      if (!match) return;
      setWatched((prev) => {
        const entry = findWatched(prev, ref);
        if (!entry || entry.tmdbId != null) return prev;
        return { ...prev, [entry.key]: { ...entry, tmdbId: match.id, year: entry.year ?? match.year, posterPath: entry.posterPath ?? match.posterPath } };
      });
    } catch {
      // Watch Next just skips this title.
    }
  };

  const toggleWatchedRef = (ref: WatchedRef, ensureFollowed: () => void) => {
    const wasWatched = isTitleWatched(findWatched(watched, ref));
    setWatched((prev) => setTitleWatched(prev, ref, !wasWatched));
    if (wasWatched) {
      showToast(`Unmarked “${ref.title}”`);
      return;
    }
    if (ref.mediaType === 'tv') {
      ensureFollowed();
      showToast(`Marked “${ref.title}” watched (all aired episodes). It’s on your Watchlist for new episodes.`);
    } else {
      showToast(`Marked “${ref.title}” watched`);
    }
    void enrichTmdbId(ref);
  };

  const toggleTitleWatched = (item: DetailItem) =>
    toggleWatchedRef(refForTitle(item), () => {
      if (item.tmdbless) {
        if (item.tvmazeId != null && !follows.some((f) => f.tvmazeId === item.tvmazeId)) addTvmazeFollow(item.tvmazeId, item.title);
      } else if (!followsByKey.has(followKey(item.mediaType, item.id))) {
        void toggleFollowTitle(item);
      }
    });

  const toggleLeadWatched = (lead: UpcomingReleaseLead) =>
    toggleWatchedRef(refForLead(lead), () => {
      if (!isLeadFollowed(lead)) toggleFollowLead(lead);
    });

  const toggleFollowWatched = (f: FollowedTitle) => toggleWatchedRef(refForFollow(f), () => undefined);

  const setDetailEpisodes = (item: DetailItem, episodes: TvmazeEpisode[], value: boolean) => {
    setWatched((prev) => setEpisodesWatched(prev, refForTitle(item), episodes, value));
  };

  const onDetailTvmazeResolved = (item: DetailItem, tvmazeId: number | null) => {
    if (tvmazeId == null) return;
    setWatched((prev) => {
      const entry = findWatched(prev, refForTitle(item));
      if (!entry || entry.tvmazeId != null) return prev;
      return { ...prev, [entry.key]: { ...entry, tvmazeId } };
    });
  };

  const isLeadWatched = useCallback((lead: UpcomingReleaseLead) => isTitleWatched(findWatched(watched, refForLead(lead))), [watched]);

  const openLead = (lead: UpcomingReleaseLead) => {
    const showId = lead.tvmaze?.showId;
    if (showId == null) return;
    const known = follows.find((f) => f.tvmazeId === showId && f.tmdbId != null);
    const w = findWatched(watched, { tvmazeId: showId });
    const tmdbId = known?.tmdbId ?? w?.tmdbId ?? null;
    setSelected(
      tmdbId != null
        ? { id: tmdbId, mediaType: 'tv', title: lead.showTitle, year: known?.year ?? w?.year ?? null, overview: '', posterPath: known?.posterPath ?? w?.posterPath ?? null, popularity: 0, tvmazeId: showId }
        : { id: 0, mediaType: 'tv', title: lead.showTitle, year: null, overview: '', posterPath: null, popularity: 0, tvmazeId: showId, tmdbless: true, platformName: lead.platformName }
    );
  };

  const watchedFollowState = (f: FollowedTitle) => {
    const entry = findWatched(watched, refForFollow(f));
    const isW = isTitleWatched(entry);
    const n = entry ? Object.values(entry.episodes).filter(Boolean).length : 0;
    const partial = isW
      ? null
      : entry?.allAiredAt
        ? 'Partly watched'
        : n > 0
          ? `${n} episode${n === 1 ? '' : 's'} watched`
          : null;
    return { watched: isW, partial };
  };

  const sources = useMemo(() => watchedSources(watched), [watched]);
  const isTmdbWatched = useCallback(
    (t: TmdbTitle) => Boolean(findWatched(watched, { key: followKey(t.mediaType, t.id), mediaType: t.mediaType, tmdbId: t.id, title: t.title })),
    [watched]
  );
  const isTmdbFollowed = useCallback((t: TmdbTitle) => followsByKey.has(followKey(t.mediaType, t.id)), [followsByKey]);

  const detailFollow = selected
    ? selected.tmdbless
      ? follows.find((f) => f.tvmazeId === selected.tvmazeId)
      : followsByKey.get(followKey(selected.mediaType, selected.id))
    : undefined;

  const availableNowLeads = useMemo(
    () => (collectorData?.leads ?? []).filter((l) => l.availabilityStatus === 'available-now'),
    [collectorData]
  );


  const platformsById = useMemo(
    () => Object.fromEntries(platforms.map((p) => [p.id, p])) as Record<PlatformId, StreamingPlatform>,
    [platforms]
  );

  const handleExportBackup = () => {
    const backup = buildCouchBackup({
      follows,
      followedLeadNames,
      alerts,
      lastCheckedAt,
      welcomeDismissed: readWelcomeDismissed(),
      discoverTypeFilter: typeFilter,
      hideWatched,
    });
    downloadJsonFile(backup, couchBackupFilename());
    showToast('Backup exported.');
  };

  const handleValidateImport = (
    rawText: string
  ): { ok: true; pending: PendingCouchImport } | { ok: false; error: string } => {
    const parsed = parseCouchBackup(rawText);
    if (!parsed.ok) return parsed;
    const { backup } = parsed;
    const count = backup.watchlist.follows.length + backup.watchlist.followedLeadNames.length;
    const summary = count === 1 ? '1 saved title' : `${count} saved titles`;
    return {
      ok: true,
      pending: {
        summary,
        apply: () => {
          applyCouchBackupToStorage(backup);
          setFollows(backup.watchlist.follows);
          setFollowedLeadNames(backup.watchlist.followedLeadNames);
          setAlerts(backup.watchlist.alerts);
          setLastCheckedAt(backup.watchlist.lastCheckedAt);
          setTypeFilter(backup.settings.discoverTypeFilter);
          setWatched(sanitizeWatched(backup.watched));
          setHideWatched(backup.settings.hideWatched);
          setBackupGeneration((n) => n + 1);
          showToast('Lists replaced from backup.');
        },
      },
    };
  };

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

      <div className="top-chrome">
        <header className="app-header">
          <div className="header-row">
            <div className="header-left">
              <button
                ref={menuButtonRef}
                type="button"
                className="menu-btn"
                aria-label="Open menu"
                aria-expanded={menuOpen}
                aria-controls="couch-side-menu"
                onClick={() => setMenuOpen(true)}
              >
                <Menu size={20} aria-hidden="true" />
              </button>
              <div className="brand-identity">
                <span className="couch-mark">
                  <CouchMarkIcon />
                </span>
                <h1 className="brand-title">{SITE.name}</h1>
              </div>
            </div>
            <div className="header-actions">
              <button type="button" className="pill-btn install-btn" onClick={handleInstallClick} title={`Install ${SITE.name}`}>
                <Download size={13} />
                Install
              </button>
            </div>
          </div>
        </header>

        <nav className="primary-nav" aria-label="Primary navigation">
          <div className="primary-nav-inner">
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
      </div>

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

            <div className="discover-controls">
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
            <HideWatchedToggle hidden={hideWatched} onChange={setHideWatched} />
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
                          isWatched={isTitleWatched(findWatched(watched, { key, mediaType: item.mediaType, tmdbId: item.id }))}
                          onToggleFollow={toggleFollowTitle}
                          onToggleWatched={toggleTitleWatched}
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
            key={backupGeneration}
            collectorData={collectorData}
            platforms={platforms}
            platformsById={platformsById}
            isLeadFollowed={isLeadFollowed}
            onToggleFollowLead={toggleFollowLead}
            isLeadWatched={isLeadWatched}
            onToggleLeadWatched={toggleLeadWatched}
            onOpenLead={openLead}
            hideWatched={hideWatched}
            onHideWatchedChange={setHideWatched}
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
            watchedState={watchedFollowState}
            onToggleWatched={toggleFollowWatched}
            watchNext={
              <WatchNext
                sources={sources}
                isWatched={isTmdbWatched}
                isFollowed={isTmdbFollowed}
                onToggleFollow={(t) => void toggleFollowTitle(t)}
                onSelect={setSelected}
              />
            }
          />
        )}

        {activeTab === 'platforms' && (
          <PlatformPage platforms={platforms} availableNowLeads={availableNowLeads} onSelectTitle={setSelected} />
        )}
      </main>

      <SideMenu
        id="couch-side-menu"
        open={menuOpen}
        onClose={closeMenu}
        restoreFocusRef={menuButtonRef}
        onOpenHelp={() => setWelcomeOpen(true)}
        onOpenAbout={() => setAboutOpen(true)}
        onExport={handleExportBackup}
        onValidateImport={handleValidateImport}
        onInstall={handleInstallClick}
        brandIcon={<CouchMarkIcon />}
      />
      <WelcomeModal open={welcomeOpen} permissionState={permissionState} onClose={closeWelcome} onRequestNotifications={handleRequestNotifications} restoreFocusRef={menuButtonRef} />
      <AboutModal open={aboutOpen} onClose={closeAbout} restoreFocusRef={menuButtonRef} />
      <TitleDetailModal
        item={selected}
        follow={detailFollow}
        watchedEntry={selected ? findWatched(watched, refForTitle(selected)) : undefined}
        onToggleFollow={(item) => {
          if (!item.tmdbless) return void toggleFollowTitle(item);
          const existing = follows.find((f) => f.tvmazeId === item.tvmazeId);
          if (existing) unfollow(existing.key);
          else if (item.tvmazeId != null) addTvmazeFollow(item.tvmazeId, item.title);
        }}
        onToggleWatched={toggleTitleWatched}
        onSetEpisodes={setDetailEpisodes}
        onTvmazeResolved={onDetailTvmazeResolved}
        onClose={closeDetail} onOptionsLoaded={(item, options) => setOptionsByKey((prev) => ({ ...prev, [followKey(item.mediaType, item.id)]: options }))} />
    </div>
  );
};

export default App;
