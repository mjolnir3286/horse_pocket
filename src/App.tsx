import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bookmark,
  Crown,
  Download,
  Film,
  Layers,
  Play,
  Rss,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import { NativeAdCard, FooterAdBanner } from './components/AdSlot';
import { PlatformPage } from './components/PlatformPage';
import { TitleCard } from './components/TitleCard';
import { TitleDetailModal } from './components/TitleDetailModal';
import { UpcomingView } from './components/UpcomingView';
import { WatchlistView } from './components/WatchlistView';
import {
  dispatchLocalEpisodeNotification,
  getNotificationPermission,
  registerServiceWorker,
  requestEpisodeNotificationPermission,
  type NotificationSupportState,
} from './services/notifications';
import { assetUrl } from './lib/baseUrl';
import { streamingProvider } from './services/streamingProvider';
import type { CollectorOutput, UpcomingReleaseLead } from './types/collector';
import type {
  MediaTitle,
  MediaType,
  NewEpisodeAlert,
  PlatformId,
  StreamingPlatform,
} from './types/streaming';

type TabId = 'discover' | 'upcoming' | 'watchlist' | 'platforms';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const WATCHLIST_STORAGE_KEY = 'horse_pocket_watchlist_v2';
const FOLLOWED_LEADS_STORAGE_KEY = 'horse_pocket_followed_leads_v1';
const PREMIUM_STORAGE_KEY = 'horse_pocket_premium_preview_v1';
const DEFAULT_WATCHLIST = ['stranger-things', 'the-bear', 'severance', 'yellowjackets'];

function normalizeTitle(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('discover');
  const [platforms, setPlatforms] = useState<StreamingPlatform[]>([]);
  const [allTitles, setAllTitles] = useState<MediaTitle[]>([]);
  const [searchResults, setSearchResults] = useState<MediaTitle[]>([]);
  const [collectorData, setCollectorData] = useState<CollectorOutput | null>(null);

  const [queryText, setQueryText] = useState('');
  const [typeFilter, setTypeFilter] = useState<MediaType | 'all'>('all');
  const [platformFilter, setPlatformFilter] = useState<PlatformId | 'all'>('all');
  const [selectedTitle, setSelectedTitle] = useState<MediaTitle | null>(null);

  const [followedIds, setFollowedIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(WATCHLIST_STORAGE_KEY);
      return saved ? (JSON.parse(saved) as string[]) : DEFAULT_WATCHLIST;
    } catch {
      return DEFAULT_WATCHLIST;
    }
  });

  const [followedLeadNames, setFollowedLeadNames] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(FOLLOWED_LEADS_STORAGE_KEY);
      return saved ? (JSON.parse(saved) as string[]) : [];
    } catch {
      return [];
    }
  });

  const [isPremium, setIsPremium] = useState<boolean>(() => {
    try {
      return localStorage.getItem(PREMIUM_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const [alerts, setAlerts] = useState<NewEpisodeAlert[]>([]);
  const [checkingEpisodes, setCheckingEpisodes] = useState(false);
  const [permissionState, setPermissionState] = useState<NotificationSupportState>(() =>
    getNotificationPermission()
  );
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
  };

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    registerServiceWorker();
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall);
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([
      streamingProvider.getPlatforms(),
      streamingProvider.getAllTitles(),
      fetch(assetUrl('data/upcoming-releases.json'))
        .then((r) => (r.ok ? (r.json() as Promise<CollectorOutput>) : null))
        .catch(() => null),
    ]).then(([plats, titles, collected]) => {
      if (!active) return;
      setPlatforms(plats);
      setAllTitles(titles);
      setSearchResults(titles);
      setCollectorData(collected);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    streamingProvider
      .searchTitles({ text: queryText, type: typeFilter, platformId: platformFilter })
      .then((results) => {
        if (active) setSearchResults(results);
      });
    return () => {
      active = false;
    };
  }, [queryText, typeFilter, platformFilter]);

  useEffect(() => {
    try {
      localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(followedIds));
    } catch {
      // ignore
    }
  }, [followedIds]);

  useEffect(() => {
    try {
      localStorage.setItem(FOLLOWED_LEADS_STORAGE_KEY, JSON.stringify(followedLeadNames));
    } catch {
      // ignore
    }
  }, [followedLeadNames]);

  useEffect(() => {
    try {
      localStorage.setItem(PREMIUM_STORAGE_KEY, String(isPremium));
    } catch {
      // ignore
    }
  }, [isPremium]);

  const platformsById = useMemo(() => {
    return platforms.reduce(
      (acc, p) => {
        acc[p.id] = p;
        return acc;
      },
      {} as Record<PlatformId, StreamingPlatform>
    );
  }, [platforms]);

  const titlesById = useMemo(() => {
    return allTitles.reduce(
      (acc, t) => {
        acc[t.id] = t;
        return acc;
      },
      {} as Record<string, MediaTitle>
    );
  }, [allTitles]);

  const followedTitles = useMemo(
    () => allTitles.filter((t) => followedIds.includes(t.id)),
    [allTitles, followedIds]
  );

  const followedNormalizedNames = useMemo(() => {
    const set = new Set<string>(followedLeadNames.map(normalizeTitle));
    for (const t of followedTitles) {
      set.add(normalizeTitle(t.title));
    }
    return set;
  }, [followedTitles, followedLeadNames]);

  const isLeadFollowed = useCallback(
    (lead: UpcomingReleaseLead) => followedNormalizedNames.has(normalizeTitle(lead.showTitle)),
    [followedNormalizedNames]
  );

  const availableNowLeads = useMemo(
    () => (collectorData?.leads ?? []).filter((l) => l.availabilityStatus === 'available-now'),
    [collectorData]
  );

  const matchedUpcomingLeads = useMemo(
    () =>
      (collectorData?.leads ?? []).filter(
        (l) => l.availabilityStatus === 'upcoming' && isLeadFollowed(l)
      ),
    [collectorData, isLeadFollowed]
  );

  const toggleFollow = (id: string) => {
    setFollowedIds((prev) => {
      const exists = prev.includes(id);
      const next = exists ? prev.filter((x) => x !== id) : [...prev, id];
      const title = titlesById[id]?.title ?? 'Show';
      showToast(exists ? `Removed "${title}" from Watchlist` : `Following "${title}" for episode alerts`);
      return next;
    });
  };

  const toggleFollowLead = (lead: UpcomingReleaseLead) => {
    const catalogMatch = allTitles.find(
      (t) => normalizeTitle(t.title) === normalizeTitle(lead.showTitle)
    );
    if (catalogMatch) {
      toggleFollow(catalogMatch.id);
      return;
    }

    const norm = normalizeTitle(lead.showTitle);
    setFollowedLeadNames((prev) => {
      const exists = prev.some((x) => normalizeTitle(x) === norm);
      const next = exists ? prev.filter((x) => normalizeTitle(x) !== norm) : [...prev, lead.showTitle];
      showToast(
        exists
          ? `Unfollowed "${lead.showTitle}"`
          : `Following "${lead.showTitle}" — matched collector leads will trigger alerts`
      );
      return next;
    });
  };

  const handleInstallClick = async () => {
    if (installPrompt) {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setInstallPrompt(null);
        showToast('Horse Pocket installed to your device!');
      }
      return;
    }
    showToast('To install on Android Chrome: open browser menu (⋮) → "Add to Home screen"');
  };

  const handleRequestNotifications = async () => {
    const result = await requestEpisodeNotificationPermission();
    setPermissionState(result);
    if (result === 'granted') {
      showToast('Push notifications enabled for Horse Pocket!');
    } else if (result === 'denied') {
      showToast('Notifications blocked in browser settings — in-app alerts remain active.');
    }
  };

  const triggerFollowedCollectorAlerts = async () => {
    if (matchedUpcomingLeads.length === 0) {
      showToast('No followed shows match the current RSS collector leads yet.');
      return;
    }

    const leadAlerts: NewEpisodeAlert[] = matchedUpcomingLeads.map((lead) => ({
      id: `rss-${lead.id}-${Date.now()}`,
      titleId: lead.id,
      showTitle: lead.showTitle,
      platformId: lead.platformId === 'unknown' ? 'paramount-plus' : lead.platformId,
      season: lead.tvmaze?.nextEpisodeSeason ?? 1,
      episode: lead.tvmaze?.nextEpisodeNumber ?? 1,
      episodeTitle:
        lead.tvmaze?.nextEpisodeName ||
        `${lead.confirmationStatus.toUpperCase()} release (${lead.parsedDateIso ?? lead.extractedDateText ?? 'TBA'})`,
      detectedAt: new Date().toISOString(),
      read: false,
    }));

    setAlerts((prev) => [...leadAlerts, ...prev].slice(0, 12));
    const first = matchedUpcomingLeads[0];
    const datePart = first.parsedDateIso ?? first.extractedDateText ?? 'Upcoming';
    const body = `${first.showTitle} (${first.confirmationStatus.toUpperCase()}) on ${first.platformName} — ${datePart}`;
    const delivery = await dispatchLocalEpisodeNotification({
      title: 'Horse Pocket — Followed Release Lead',
      body,
      tag: `horse-pocket-lead-${Date.now()}`,
    });

    showToast(
      delivery.deliveredVia === 'in-app-only'
        ? `Followed lead alert: ${body}`
        : `Push sent (${delivery.deliveredVia}): ${body}`
    );
  };

  const handleCheckNewEpisodes = async () => {
    setCheckingEpisodes(true);
    try {
      const found = await streamingProvider.checkNewEpisodes(followedIds);
      const rssAlerts: NewEpisodeAlert[] = matchedUpcomingLeads.map((lead) => ({
        id: `rss-${lead.id}-${Date.now()}`,
        titleId: lead.id,
        showTitle: `${lead.showTitle} [${lead.confirmationStatus.toUpperCase()} RSS]`,
        platformId: lead.platformId === 'unknown' ? 'paramount-plus' : lead.platformId,
        season: lead.tvmaze?.nextEpisodeSeason ?? 1,
        episode: lead.tvmaze?.nextEpisodeNumber ?? 1,
        episodeTitle:
          lead.tvmaze?.nextEpisodeName ??
          `Air date ${lead.parsedDateIso ?? lead.extractedDateText ?? 'TBA'}`,
        detectedAt: new Date().toISOString(),
        read: false,
      }));

      const combined = [...rssAlerts, ...found];
      if (combined.length === 0) {
        showToast('No ongoing series or collector matches in your watchlist yet.');
        return;
      }

      setAlerts((prev) => [...combined, ...prev].slice(0, 12));
      const lead = combined[0];
      const platName = platformsById[lead.platformId]?.name ?? lead.platformId;
      const body =
        combined.length === 1
          ? `${lead.showTitle} S${lead.season}E${lead.episode} ("${lead.episodeTitle}") on ${platName}.`
          : `${lead.showTitle} S${lead.season}E${lead.episode} + ${combined.length - 1} more alert(s) found!`;

      const delivery = await dispatchLocalEpisodeNotification({
        title: 'Horse Pocket — New Episode Alert',
        body,
        tag: `horse-pocket-${Date.now()}`,
      });

      if (delivery.deliveredVia === 'in-app-only') {
        showToast(`New episode alert: ${body}`);
      } else {
        showToast(`Notification sent via ${delivery.deliveredVia}: ${lead.showTitle}`);
      }
    } finally {
      setCheckingEpisodes(false);
    }
  };

  return (
    <div className="app-shell">
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}

      <header className="app-header">
        <div className="header-row">
          <div className="brand">
            <div className="brand-mark">
              <Play size={17} fill="currentColor" />
            </div>
            <div>
              <h1 className="brand-title">Horse Pocket</h1>
              <span className="brand-subtitle">Where to watch • Episode alerts</span>
            </div>
          </div>

          <div className="header-actions">
            <button
              type="button"
              className={`pill-btn ${isPremium ? 'premium-on' : ''}`}
              onClick={() => {
                const next = !isPremium;
                setIsPremium(next);
                showToast(
                  next
                    ? 'Premium Preview ON — ad slots hidden'
                    : 'Free Tier Preview — unobtrusive ad slots visible'
                );
              }}
              title="Toggle mock Free vs. Ad-Free Premium view"
            >
              <Crown size={13} color={isPremium ? 'var(--accent-bright)' : 'var(--text-muted)'} />
              {isPremium ? 'Premium' : 'Free Tier'}
            </button>

            <button
              type="button"
              className="pill-btn install-btn"
              onClick={handleInstallClick}
              title="Install Horse Pocket as an Android/Desktop PWA"
            >
              <Download size={13} />
              Install
            </button>
          </div>
        </div>

        <div className="demo-strip">
          <span className="demo-badge">
            <Sparkles size={11} /> {streamingProvider.providerName}
          </span>
          <span>
            {isPremium
              ? 'Ad-free preview active'
              : 'Unobtrusive ad placeholders active (toggle Free/Premium above)'}
          </span>
        </div>
      </header>

      <main className="app-main">
        {activeTab === 'discover' && (
          <div>
            <div className="search-box">
              <Search size={18} className="search-icon" />
              <input
                type="search"
                className="search-input"
                placeholder="Search shows, movies, genres (e.g. Severance, Dune, Sci-Fi)..."
                value={queryText}
                onChange={(e) => setQueryText(e.target.value)}
                aria-label="Search shows and movies"
              />
              {queryText && (
                <button
                  type="button"
                  className="search-clear"
                  onClick={() => setQueryText('')}
                  aria-label="Clear search"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            <div className="chip-scroll" aria-label="Filter by media type">
              {(['all', 'series', 'movie'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`filter-chip ${typeFilter === t ? 'active' : ''}`}
                  onClick={() => setTypeFilter(t)}
                >
                  {t === 'all' ? 'All Titles' : t === 'series' ? 'TV Series' : 'Movies'}
                </button>
              ))}
            </div>

            <div className="chip-scroll" aria-label="Filter by streaming platform">
              <button
                type="button"
                className={`filter-chip ${platformFilter === 'all' ? 'active' : ''}`}
                onClick={() => setPlatformFilter('all')}
              >
                All Platforms
              </button>
              {platforms.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`filter-chip ${platformFilter === p.id ? 'active' : ''}`}
                  onClick={() => setPlatformFilter(p.id)}
                >
                  <span
                    className="platform-dot"
                    style={{
                      backgroundColor: p.brandColor,
                      display: 'inline-block',
                      marginRight: 6,
                    }}
                  />
                  {p.name}
                </button>
              ))}
            </div>

            <div className="section-heading">
              <h2>Where to Watch</h2>
              <span className="section-meta">{searchResults.length} results</span>
            </div>

            {searchResults.length === 0 ? (
              <div className="panel" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 28 }}>
                No matching titles in the current catalog. Try clearing a filter or searching another title.
              </div>
            ) : (
              <div className="card-grid">
                {searchResults.map((item, idx) => (
                  <React.Fragment key={item.id}>
                    <TitleCard
                      item={item}
                      platformsById={platformsById}
                      isFollowed={followedIds.includes(item.id)}
                      onToggleFollow={toggleFollow}
                      onSelect={setSelectedTitle}
                    />
                    {idx === 2 && (
                      <NativeAdCard
                        isPremium={isPremium}
                        onEnablePremium={() => {
                          setIsPremium(true);
                          showToast('Premium Preview ON — ad slots hidden');
                        }}
                      />
                    )}
                  </React.Fragment>
                ))}
                {searchResults.length > 0 && searchResults.length <= 2 && (
                  <NativeAdCard
                    isPremium={isPremium}
                    onEnablePremium={() => {
                      setIsPremium(true);
                      showToast('Premium Preview ON — ad slots hidden');
                    }}
                  />
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'upcoming' && (
          <UpcomingView
            collectorData={collectorData}
            platformsById={platformsById}
            isLeadFollowed={isLeadFollowed}
            onToggleFollowLead={toggleFollowLead}
            onTriggerFollowedAlerts={triggerFollowedCollectorAlerts}
          />
        )}

        {activeTab === 'watchlist' && (
          <WatchlistView
            followedTitles={followedTitles}
            platformsById={platformsById}
            alerts={alerts}
            permissionState={permissionState}
            checking={checkingEpisodes}
            onRequestPermission={handleRequestNotifications}
            onCheckNewEpisodes={handleCheckNewEpisodes}
            onToggleFollow={toggleFollow}
            onSelectTitle={setSelectedTitle}
            onClearAlerts={() => setAlerts([])}
          />
        )}

        {activeTab === 'platforms' && (
          <PlatformPage
            platforms={platforms}
            titlesById={titlesById}
            allTitles={allTitles}
            followedIds={followedIds}
            isPremium={isPremium}
            availableNowLeads={availableNowLeads}
            onEnablePremium={() => {
              setIsPremium(true);
              showToast('Premium Preview ON — ad slots hidden');
            }}
            onSelectTitle={setSelectedTitle}
          />
        )}
      </main>

      <FooterAdBanner isPremium={isPremium} />

      <nav className="bottom-nav" aria-label="Primary navigation">
        <div className="bottom-nav-inner">
          <button
            type="button"
            className={`nav-tab ${activeTab === 'discover' ? 'active' : ''}`}
            onClick={() => setActiveTab('discover')}
          >
            <Film size={19} />
            <span>Discover</span>
          </button>

          <button
            type="button"
            className={`nav-tab ${activeTab === 'upcoming' ? 'active' : ''}`}
            onClick={() => setActiveTab('upcoming')}
          >
            <Rss size={19} />
            {matchedUpcomingLeads.length > 0 && (
              <span className="nav-badge">{matchedUpcomingLeads.length}</span>
            )}
            <span>Upcoming</span>
          </button>

          <button
            type="button"
            className={`nav-tab ${activeTab === 'watchlist' ? 'active' : ''}`}
            onClick={() => setActiveTab('watchlist')}
          >
            <Bookmark size={19} />
            {(alerts.length > 0 || followedIds.length > 0) && (
              <span className="nav-badge">
                {alerts.length > 0 ? alerts.length : followedIds.length}
              </span>
            )}
            <span>Watchlist</span>
          </button>

          <button
            type="button"
            className={`nav-tab ${activeTab === 'platforms' ? 'active' : ''}`}
            onClick={() => setActiveTab('platforms')}
          >
            <Layers size={19} />
            <span>Platforms</span>
          </button>
        </div>
      </nav>

      <TitleDetailModal
        item={selectedTitle}
        platformsById={platformsById}
        isFollowed={selectedTitle ? followedIds.includes(selectedTitle.id) : false}
        onToggleFollow={toggleFollow}
        onClose={() => setSelectedTitle(null)}
      />
    </div>
  );
};

export default App;
