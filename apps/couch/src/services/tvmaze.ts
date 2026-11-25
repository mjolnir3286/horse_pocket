/** Browser-side TVmaze calls (free, no key, CC BY-SA). Used for episode tracking. */
const TVMAZE = 'https://api.tvmaze.com';

export interface TvmazeEpisode {
  id: number;
  season: number;
  number: number | null;
  name: string;
  airdate: string | null;
  airstamp: string | null;
}

export interface TvmazeShowStatus {
  id: number;
  name: string;
  status: string;
  network: string | null;
  url: string;
  previous: TvmazeEpisode | null;
  next: TvmazeEpisode | null;
}

interface RawEpisode {
  id: number;
  season: number;
  number: number | null;
  name?: string;
  airdate?: string;
  airstamp?: string;
}

function toEpisode(e?: RawEpisode | null): TvmazeEpisode | null {
  if (!e) return null;
  return {
    id: e.id,
    season: e.season,
    number: e.number ?? null,
    name: e.name || 'Episode',
    airdate: e.airdate || null,
    airstamp: e.airstamp || null,
  };
}

/** Find a TVmaze show from the IMDb id TMDB gives us (fallback: TheTVDB id). */
export async function lookupTvmazeId(ids: { imdbId: string | null; tvdbId: number | null }): Promise<number | null> {
  const tries: string[] = [];
  if (ids.imdbId) tries.push(`imdb=${encodeURIComponent(ids.imdbId)}`);
  if (ids.tvdbId) tries.push(`thetvdb=${ids.tvdbId}`);
  for (const q of tries) {
    try {
      const res = await fetch(`${TVMAZE}/lookup/shows?${q}`);
      if (res.ok) {
        const show = (await res.json()) as { id?: number };
        if (show.id) return show.id;
      }
    } catch {
      // try the next id
    }
  }
  return null;
}

export async function getShowStatus(tvmazeId: number): Promise<TvmazeShowStatus> {
  const res = await fetch(`${TVMAZE}/shows/${tvmazeId}?embed[]=nextepisode&embed[]=previousepisode`);
  if (!res.ok) throw new Error(`TVmaze HTTP ${res.status}`);
  const s = (await res.json()) as {
    id: number;
    name: string;
    status?: string;
    url?: string;
    network?: { name: string } | null;
    webChannel?: { name: string } | null;
    _embedded?: { nextepisode?: RawEpisode; previousepisode?: RawEpisode };
  };
  return {
    id: s.id,
    name: s.name,
    status: s.status || 'Unknown',
    network: s.webChannel?.name ?? s.network?.name ?? null,
    url: s.url || `https://www.tvmaze.com/shows/${s.id}`,
    previous: toEpisode(s._embedded?.previousepisode),
    next: toEpisode(s._embedded?.nextepisode),
  };
}
