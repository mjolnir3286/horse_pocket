import type { PlatformGroup, PlatformId, StreamingPlatform } from '../types/streaming';

/**
 * Curated mainstream US services (issue #5). TMDB provider ids were checked against
 * TMDB's US /watch/providers lists on 2026-11-25. No prices: each service links to its own site.
 */
const NETWORK_NOTE = 'Some full episodes need a TV provider sign-in.';

export const PLATFORM_GROUPS: Array<{ id: PlatformGroup; label: string }> = [
  { id: 'subscription', label: 'Subscription' },
  { id: 'free', label: 'Free with ads' },
  { id: 'network', label: 'Network apps' },
];

export const PLATFORMS: StreamingPlatform[] = [
  { id: 'netflix', group: 'subscription', name: 'Netflix', shortCode: 'NF', brandColor: '#E50914', tmdbProviderIds: [8, 1796], logoPath: '/rK1KljqmbvO9HQa1PBFLILWah72.png', websiteUrl: 'https://www.netflix.com' },
  { id: 'prime-video', group: 'subscription', name: 'Prime Video', shortCode: 'PV', brandColor: '#00A8E1', tmdbProviderIds: [9, 2100], logoPath: '/gMZdpavHmxFNnLpMHwVxfqeux2g.png', websiteUrl: 'https://www.primevideo.com' },
  { id: 'disney-plus', group: 'subscription', name: 'Disney+', shortCode: 'D+', brandColor: '#113CCF', tmdbProviderIds: [337], logoPath: '/5eZ872CghnHFLB1j8grszbrx0dx.png', websiteUrl: 'https://www.disneyplus.com' },
  { id: 'hulu', group: 'subscription', name: 'Hulu', shortCode: 'HL', brandColor: '#1CE783', tmdbProviderIds: [15], logoPath: '/44uAnmSqvA4yBOdbPWN8YgQHjWm.png', websiteUrl: 'https://www.hulu.com' },
  { id: 'max', group: 'subscription', name: 'HBO Max', shortCode: 'HM', brandColor: '#002BE7', tmdbProviderIds: [1899], logoPath: '/skypuy7SXuugIQeYg0IglmzoKaS.png', websiteUrl: 'https://www.hbomax.com' },
  { id: 'apple-tv-plus', group: 'subscription', name: 'Apple TV+', shortCode: 'TV', brandColor: '#64748B', tmdbProviderIds: [350], logoPath: '/v9SnyvYt0U3KGgBH3Sbh3z4yODe.png', websiteUrl: 'https://tv.apple.com' },
  { id: 'peacock', group: 'subscription', name: 'Peacock', shortCode: 'PK', brandColor: '#B7791F', tmdbProviderIds: [386, 387], logoPath: '/a1UIdq5BrkcAxnxcUhFsNbXnxeu.png', websiteUrl: 'https://www.peacocktv.com' },
  { id: 'paramount-plus', group: 'subscription', name: 'Paramount+', shortCode: 'P+', brandColor: '#0064FF', tmdbProviderIds: [2303, 2616], logoPath: '/4N4BMd0Mm0kHAmF7RZgL5lW3cwc.png', websiteUrl: 'https://www.paramountplus.com' },
  { id: 'starz', group: 'subscription', name: 'Starz', shortCode: 'SZ', brandColor: '#111111', tmdbProviderIds: [43], logoPath: '/h25xjouKmiSmFiiqw0aDXbxGZo7.png', websiteUrl: 'https://www.starz.com' },
  { id: 'mgm-plus', group: 'subscription', name: 'MGM+', shortCode: 'M+', brandColor: '#A07C2C', tmdbProviderIds: [34], logoPath: '/q63Uzpu7JAs566vA2G23Lk7LcID.png', websiteUrl: 'https://www.mgmplus.com' },
  { id: 'amc-plus', group: 'subscription', name: 'AMC+', shortCode: 'A+', brandColor: '#1F2937', tmdbProviderIds: [526], logoPath: '/wsCUflcmL4dCkzBUaGP8cj1cTkh.png', websiteUrl: 'https://www.amcplus.com' },
  { id: 'crunchyroll', group: 'subscription', name: 'Crunchyroll', shortCode: 'CR', brandColor: '#F47521', tmdbProviderIds: [283], logoPath: '/uFL3c4Cq8M6WoLymlC5Y8bmGytV.png', websiteUrl: 'https://www.crunchyroll.com' },
  { id: 'discovery-plus', group: 'subscription', name: 'discovery+', shortCode: 'd+', brandColor: '#2175D9', tmdbProviderIds: [520], logoPath: '/tHseJEgZaUdVlLtBpOGmKPfzbQ8.png', websiteUrl: 'https://www.discoveryplus.com' },
  { id: 'angel', group: 'subscription', name: 'Angel Studios', shortCode: 'AN', brandColor: '#B45309', tmdbProviderIds: [1956], logoPath: '/pusUxS9dP5VK7HkN8SLf2wnP9gm.png', websiteUrl: 'https://www.angel.com', note: 'Some titles are free to watch; membership unlocks more.' },
  { id: 'tubi', group: 'free', name: 'Tubi', shortCode: 'TB', brandColor: '#7408FF', tmdbProviderIds: [73], logoPath: '/9dEuvA8wg5TSeFBZlPxSVxFdimJ.png', websiteUrl: 'https://tubitv.com' },
  { id: 'pluto-tv', group: 'free', name: 'Pluto TV', shortCode: 'PL', brandColor: '#2D2D2D', tmdbProviderIds: [300], logoPath: '/fN4czqaMQNLeF6sSSIjGbAWzvwK.png', websiteUrl: 'https://pluto.tv' },
  { id: 'roku-channel', group: 'free', name: 'The Roku Channel', shortCode: 'RC', brandColor: '#6C3C97', tmdbProviderIds: [207], logoPath: '/b7uhrYJtAe7b1ieJGg705vTbwrX.png', websiteUrl: 'https://www.roku.com/whats-on/the-roku-channel' },
  { id: 'pbs', group: 'network', name: 'PBS', shortCode: 'PB', brandColor: '#2638C4', tmdbProviderIds: [209], logoPath: '/kwKCUFjKjq1GlZeIjImBV62IypB.png', websiteUrl: 'https://www.pbs.org', note: 'Many shows are free; PBS Passport unlocks more.' },
  { id: 'investigation-discovery', group: 'network', name: 'Investigation Discovery', shortCode: 'ID', brandColor: '#B91C1C', tmdbProviderIds: [408], logoPath: '/A0AozqqtTnp2xDRxJFbtETyCgDC.png', websiteUrl: 'https://www.investigationdiscovery.com', note: `${NETWORK_NOTE} ID shows are also on HBO Max and discovery+.` },
  { id: 'ae', group: 'network', name: 'A&E', shortCode: 'AE', brandColor: '#374151', tmdbProviderIds: [156], logoPath: '/uZCkdQoyMucDbIylu2jVZp7N0B.png', websiteUrl: 'https://www.aetv.com', note: NETWORK_NOTE },
  { id: 'history', group: 'network', name: 'History', shortCode: 'H', brandColor: '#7C2D12', tmdbProviderIds: [155], logoPath: '/4cHhgsNAxu15DEut0ZBmc8lK0Zt.png', websiteUrl: 'https://www.history.com', note: NETWORK_NOTE },
  { id: 'lifetime', group: 'network', name: 'Lifetime', shortCode: 'LT', brandColor: '#BE185D', tmdbProviderIds: [157], logoPath: '/qZrPlzjZWFHSmvE3bQdRlFGy8iW.png', websiteUrl: 'https://www.mylifetime.com', note: NETWORK_NOTE },
  { id: 'abc', group: 'network', name: 'ABC', shortCode: 'ABC', brandColor: '#111827', tmdbProviderIds: [148], logoPath: '/wlIBJalNhr0vHuhYBk0uqevxwvX.png', websiteUrl: 'https://abc.com', note: NETWORK_NOTE },
  { id: 'nbc', group: 'network', name: 'NBC', shortCode: 'NBC', brandColor: '#4338CA', tmdbProviderIds: [79], logoPath: '/geRNAmvuPF6hOLExMHLKpt7bGBD.png', websiteUrl: 'https://www.nbc.com', note: NETWORK_NOTE },
];

export const PLATFORM_IDS: ReadonlySet<string> = new Set(PLATFORMS.map((p) => p.id));

export const isPlatformId = (value: unknown): value is PlatformId => typeof value === 'string' && PLATFORM_IDS.has(value);

const BY_PROVIDER = new Map<number, StreamingPlatform>();
for (const p of PLATFORMS) for (const id of p.tmdbProviderIds) BY_PROVIDER.set(id, p);

/** Map a TMDB provider id to one of Couch's tracked platforms, if it is one. */
export function platformForProvider(providerId: number): StreamingPlatform | undefined {
  return BY_PROVIDER.get(providerId);
}
