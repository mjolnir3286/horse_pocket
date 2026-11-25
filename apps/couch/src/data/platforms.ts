import type { StreamingPlatform } from '../types/streaming';

/**
 * HAND-MAINTAINED US PLAN PRICES.
 * Every number below was read from the service's own page on PRICES_CHECKED_ON.
 * A null price means we could not confirm it on an official page: the app shows
 * "Not verified" with a link instead of guessing. Promotions are not listed.
 * To update: open pricingUrl, copy the regular price, change pricesCheckedOn.
 */
export const PRICES_CHECKED_ON = '2026-11-25';

export const PLATFORMS: StreamingPlatform[] = [
  {
    id: 'netflix',
    tmdbProviderIds: [8, 1796],
    tier: 'priority',
    name: 'Netflix',
    shortCode: 'NF',
    brandColor: '#E50914',
    tagline: 'Original series, films, and games',
    plans: [
      { name: 'Standard with ads', monthlyPrice: '$8.99/mo', hasAds: true, notes: '1080p, 2 screens' },
      { name: 'Standard', monthlyPrice: '$19.99/mo', hasAds: false, notes: '1080p, 2 screens' },
      { name: 'Premium', monthlyPrice: '$26.99/mo', hasAds: false, notes: '4K + HDR, 4 screens' },
    ],
    pricingUrl: 'https://help.netflix.com/en/node/24926',
    pricesCheckedOn: PRICES_CHECKED_ON,
    pricingNote: 'Monthly billing only.',
    websiteUrl: 'https://www.netflix.com',
  },
  {
    id: 'disney-plus',
    tmdbProviderIds: [337],
    tier: 'priority',
    name: 'Disney+',
    shortCode: 'D+',
    brandColor: '#113CCF',
    tagline: 'Disney, Pixar, Marvel, Star Wars, National Geographic',
    plans: [
      { name: 'Disney+ (With Ads)', monthlyPrice: '$12.49/mo', hasAds: true },
      { name: 'Disney+ Premium (No Ads)', monthlyPrice: '$21.49/mo', annualPrice: '$214.99/yr', hasAds: false },
    ],
    pricingUrl: 'https://www.disneyplus.com/welcome',
    pricesCheckedOn: PRICES_CHECKED_ON,
    pricingNote: 'Bundles with Hulu and HBO Max are also offered.',
    websiteUrl: 'https://www.disneyplus.com',
  },
  {
    id: 'hulu',
    tmdbProviderIds: [15],
    tier: 'priority',
    name: 'Hulu',
    shortCode: 'HL',
    brandColor: '#1CE783',
    tagline: 'Next-day TV, FX, and Hulu Originals',
    plans: [
      { name: 'Hulu (With Ads)', monthlyPrice: null, hasAds: true },
      { name: 'Hulu (No Ads)', monthlyPrice: null, hasAds: false },
      { name: 'Disney+, Hulu Bundle (With Ads)', monthlyPrice: '$12.99/mo', hasAds: true },
      { name: 'Disney+, Hulu Bundle Premium (No Ads)', monthlyPrice: '$21.99/mo', hasAds: false },
    ],
    pricingUrl: 'https://www.hulu.com/welcome',
    pricesCheckedOn: PRICES_CHECKED_ON,
    pricingNote: 'Standalone Hulu prices were not shown on the official page we checked.',
    websiteUrl: 'https://www.hulu.com',
  },
  {
    id: 'prime-video',
    tmdbProviderIds: [9, 2100],
    tier: 'priority',
    name: 'Prime Video',
    shortCode: 'PV',
    brandColor: '#00A8E1',
    tagline: 'Amazon Originals, MGM, and channel add-ons',
    plans: [
      {
        name: 'Amazon Prime (includes Prime Video with ads)',
        monthlyPrice: '$14.99/mo',
        annualPrice: '$139/yr',
        hasAds: true,
      },
      { name: 'Prime Video only', monthlyPrice: null, hasAds: true },
      { name: 'Ad-free add-on', monthlyPrice: null, hasAds: false },
    ],
    pricingUrl: 'https://www.amazon.com/amazonprime',
    pricesCheckedOn: PRICES_CHECKED_ON,
    websiteUrl: 'https://www.amazon.com/primevideo',
  },
  {
    id: 'max',
    tmdbProviderIds: [1899],
    tier: 'priority',
    name: 'HBO Max',
    shortCode: 'HM',
    brandColor: '#002BE7',
    tagline: 'HBO, Warner Bros., and DC',
    plans: [
      { name: 'Basic with Ads', monthlyPrice: '$10.99/mo', annualPrice: '$109.99/yr', hasAds: true },
      { name: 'Standard', monthlyPrice: '$18.49/mo', annualPrice: '$184.99/yr', hasAds: false },
      { name: 'Premium', monthlyPrice: '$22.99/mo', annualPrice: '$229.99/yr', hasAds: false },
    ],
    pricingUrl: 'https://help.hbomax.com/us/Answer/Detail/000002547',
    pricesCheckedOn: PRICES_CHECKED_ON,
    websiteUrl: 'https://www.hbomax.com',
  },
  {
    id: 'apple-tv-plus',
    tmdbProviderIds: [350],
    tier: 'secondary',
    name: 'Apple TV',
    shortCode: 'TV',
    brandColor: '#64748B',
    tagline: 'Apple Originals (formerly Apple TV+)',
    plans: [{ name: 'Monthly', monthlyPrice: '$14.99/mo', hasAds: false }],
    pricingUrl: 'https://www.apple.com/apple-tv/',
    pricesCheckedOn: PRICES_CHECKED_ON,
    pricingNote: 'Also included in Apple One.',
    websiteUrl: 'https://tv.apple.com',
  },
  {
    id: 'peacock',
    tmdbProviderIds: [386, 387],
    tier: 'secondary',
    name: 'Peacock',
    shortCode: 'PK',
    brandColor: '#B7791F',
    tagline: 'NBCUniversal shows, movies, and live sports',
    plans: [
      { name: 'Select (With Ads)', monthlyPrice: '$8.99/mo', annualPrice: '$89.99/yr', hasAds: true, notes: 'TV favorites only' },
      { name: 'Premium (With Ads)', monthlyPrice: '$12.99/mo', annualPrice: '$129.99/yr', hasAds: true },
      { name: 'Premium Plus (No Ads*)', monthlyPrice: '$19.99/mo', annualPrice: '$199.99/yr', hasAds: false, notes: '*Ads remain on live content' },
    ],
    pricingUrl: 'https://www.peacocktv.com/',
    pricesCheckedOn: PRICES_CHECKED_ON,
    websiteUrl: 'https://www.peacocktv.com',
  },
  {
    id: 'paramount-plus',
    tmdbProviderIds: [2303, 2616, 531],
    tier: 'secondary',
    name: 'Paramount+',
    shortCode: 'P+',
    brandColor: '#0064FF',
    tagline: 'CBS, SHOWTIME, Star Trek, and Paramount Pictures',
    plans: [
      { name: 'Essential (With Ads)', monthlyPrice: '$8.99/mo', annualPrice: null, hasAds: true },
      { name: 'Premium (No Ads*)', monthlyPrice: '$13.99/mo', annualPrice: null, hasAds: false, notes: '*Except live TV' },
    ],
    pricingUrl: 'https://www.paramountplus.com/',
    pricesCheckedOn: PRICES_CHECKED_ON,
    websiteUrl: 'https://www.paramountplus.com',
  },
];

const BY_PROVIDER = new Map<number, StreamingPlatform>();
for (const p of PLATFORMS) for (const id of p.tmdbProviderIds) BY_PROVIDER.set(id, p);

/** Map a TMDB provider id to one of Couch's tracked platforms, if it is one. */
export function platformForProvider(providerId: number): StreamingPlatform | undefined {
  return BY_PROVIDER.get(providerId);
}
