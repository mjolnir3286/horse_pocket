import React, { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { resolveTvmazeId } from '../services/follows';
import { getSeasonWatchOptions, getTvSeasons, hasAnyWatchOption, type TmdbSeason, type WatchOptions } from '../services/tmdb';
import { getShowEpisodes, type TvmazeEpisode } from '../services/tvmaze';
import { hasAired, isEpisodeWatched, isTitleWatched, type WatchedEntry } from '../services/watched';
import { WatchOptionsSummary } from './WatchOptions';

interface EpisodesSectionProps {
  title: string;
  tmdbId: number | null;
  tvmazeId: number | null;
  entry: WatchedEntry | undefined;
  showOptions: WatchOptions | null | undefined;
  onTvmazeResolved?: (id: number | null) => void;
  onSetEpisodes: (episodes: TvmazeEpisode[], watched: boolean) => void;
  onCaughtUp?: (caughtUp: boolean) => void;
}

function formatDate(iso: string | null): string {
  if (!iso) return 'TBA';
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Season picker, per-season where-to-watch (falls back to the show's list), and episode checkboxes. */
export const EpisodesSection: React.FC<EpisodesSectionProps> = ({
  title,
  tmdbId,
  tvmazeId: initialTvmazeId,
  entry,
  showOptions,
  onTvmazeResolved,
  onSetEpisodes,
  onCaughtUp,
}) => {
  const [tvmazeId, setTvmazeId] = useState<number | null | undefined>(initialTvmazeId ?? undefined);
  const [episodes, setEpisodes] = useState<TvmazeEpisode[] | null | undefined>(undefined);
  const [season, setSeason] = useState<number | null>(null);
  const [seasonOptions, setSeasonOptions] = useState<WatchOptions | null | undefined>(undefined);
  const [tmdbSeasons, setTmdbSeasons] = useState<TmdbSeason[] | null | undefined>(undefined);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (initialTvmazeId != null) {
      setTvmazeId(initialTvmazeId);
      return;
    }
    if (tmdbId == null) {
      setTvmazeId(null);
      return;
    }
    setTvmazeId(undefined);
    resolveTvmazeId(tmdbId).then((id) => {
      if (cancelled) return;
      setTvmazeId(id);
      onTvmazeResolved?.(id);
    });
    return () => {
      cancelled = true;
    };
  }, [tmdbId, initialTvmazeId]);

  useEffect(() => {
    if (tvmazeId == null) {
      setEpisodes(tvmazeId === null ? null : undefined);
      return;
    }
    let cancelled = false;
    setEpisodes(undefined);
    getShowEpisodes(tvmazeId)
      .then((eps) => !cancelled && setEpisodes(eps))
      .catch(() => !cancelled && setEpisodes(null));
    return () => {
      cancelled = true;
    };
  }, [tvmazeId]);

  const seasons = useMemo(() => {
    const map = new Map<number, TvmazeEpisode[]>();
    for (const ep of episodes ?? []) {
      const list = map.get(ep.season) ?? [];
      list.push(ep);
      map.set(ep.season, list);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [episodes]);

  // Default to the first season that still has an aired, unwatched episode; otherwise the latest aired one.
  useEffect(() => {
    if (!seasons.length || season != null) return;
    const firstOpen = seasons.find(([, eps]) => eps.some((e) => hasAired(e) && !isEpisodeWatched(entry, e)));
    const latestAired = [...seasons].reverse().find(([, eps]) => eps.some((e) => hasAired(e)));
    setSeason((firstOpen ?? latestAired ?? seasons[0])[0]);
  }, [seasons]);

  useEffect(() => {
    if (tmdbId == null) {
      setTmdbSeasons(null);
      return;
    }
    let cancelled = false;
    setTmdbSeasons(undefined);
    getTvSeasons(tmdbId)
      .then((list) => !cancelled && setTmdbSeasons(list))
      .catch(() => !cancelled && setTmdbSeasons(null));
    return () => {
      cancelled = true;
    };
  }, [tmdbId]);

  useEffect(() => {
    if (!onCaughtUp) return;
    if (episodes === undefined) return;
    onCaughtUp(isTitleWatched(entry, episodes ?? undefined));
  }, [entry, episodes, onCaughtUp]);

  const current = seasons.find(([n]) => n === season)?.[1] ?? [];
  const aired = current.filter((e) => hasAired(e));
  const watchedCount = aired.filter((e) => isEpisodeWatched(entry, e)).length;
  const seasonDone = aired.length > 0 && watchedCount === aired.length;

  // null = still loading season metadata; false = TVmaze and TMDB disagree (or TMDB has no such season).
  const countsAgree =
    season == null || episodes === undefined || tmdbSeasons === undefined
      ? null
      : tmdbSeasons != null && tmdbSeasons.some((s) => s.seasonNumber === season && s.episodeCount === current.length);

  useEffect(() => {
    if (season == null || tmdbId == null || countsAgree === false) {
      setSeasonOptions(null);
      return;
    }
    if (countsAgree == null) {
      setSeasonOptions(undefined);
      return;
    }
    const ctrl = new AbortController();
    setSeasonOptions(undefined);
    getSeasonWatchOptions(tmdbId, season, ctrl.signal)
      .then((o) => setSeasonOptions(o))
      .catch(() => !ctrl.signal.aborted && setSeasonOptions(null));
    return () => ctrl.abort();
  }, [tmdbId, season, countsAgree]);

  const seasonHasOwn = countsAgree === true && seasonOptions ? hasAnyWatchOption(seasonOptions) : false;

  return (
    <section className="episodes-section" aria-label={`Seasons and episodes of ${title}`}>
      <button type="button" className="episodes-head" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="detail-section-label" style={{ margin: 0 }}>
          Seasons &amp; episodes
        </span>
        <ChevronDown size={14} className={`episodes-chevron ${open ? 'open' : ''}`} aria-hidden="true" />
      </button>

      {open && (
        <>
          {tvmazeId === undefined || episodes === undefined ? (
            <p className="muted small">Loading episodes…</p>
          ) : episodes === null ? (
            <p className="muted small">Episode list isn’t available for this show (no TVmaze match).</p>
          ) : seasons.length === 0 ? (
            <p className="muted small">No episodes listed yet.</p>
          ) : (
            <>
              <div className="season-chips" role="tablist" aria-label="Seasons">
                {seasons.map(([n, eps]) => {
                  const a = eps.filter((e) => hasAired(e));
                  const done = a.length > 0 && a.every((e) => isEpisodeWatched(entry, e));
                  return (
                    <button
                      key={n}
                      type="button"
                      role="tab"
                      aria-selected={season === n}
                      className={`filter-chip season-chip ${season === n ? 'active' : ''}`}
                      onClick={() => setSeason(n)}
                    >
                      {done && <Check size={12} aria-hidden="true" />} S{n}
                    </button>
                  );
                })}
              </div>

              {tmdbId != null && (
                <div className="season-providers">
                  <div className="season-providers-label">
                    {countsAgree === false
                      ? `Season ${season}: episode counts don’t match, showing the show’s options`
                      : seasonOptions === undefined
                        ? `Season ${season}: checking where to watch…`
                        : seasonHasOwn
                          ? `Season ${season} streams on`
                          : `Season ${season}: no season-specific listing, showing the show’s options`}
                  </div>
                  {(countsAgree === false || seasonOptions !== undefined) && (
                    <WatchOptionsSummary options={seasonHasOwn ? seasonOptions : showOptions} />
                  )}
                </div>
              )}

              <div className="season-bar">
                <span className="small">
                  <strong>Season {season}</strong>
                </span>
                <button
                  type="button"
                  className="text-btn season-mark-btn"
                  disabled={aired.length === 0}
                  onClick={() => onSetEpisodes(aired, !seasonDone)}
                >
                  <Check size={13} aria-hidden="true" /> {seasonDone ? 'Unmark season' : 'Mark season watched'}
                </button>
              </div>

              <ul className="episode-list">
                {current.map((ep) => {
                  const isAired = hasAired(ep);
                  const watched = isEpisodeWatched(entry, ep);
                  const id = `ep-${ep.id}`;
                  return (
                    <li key={ep.id} className={`episode-row ${watched ? 'watched' : ''} ${isAired ? '' : 'unaired'}`}>
                      <input
                        id={id}
                        type="checkbox"
                        checked={watched}
                        disabled={!isAired}
                        onChange={(e) => onSetEpisodes([ep], e.target.checked)}
                      />
                      <label htmlFor={id}>
                        <span className="episode-num">{ep.number != null ? `E${ep.number}` : 'Special'}</span>
                        <span className="episode-name">{ep.name}</span>
                        <span className="episode-date muted">{isAired ? formatDate(ep.airdate) : `Airs ${formatDate(ep.airdate)}`}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
              <p className="fineprint">Episode list from TVmaze. Season availability by JustWatch, via TMDB.</p>
            </>
          )}
        </>
      )}
    </section>
  );
};
