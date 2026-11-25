/**
 * Site title, credits, and maker info — edit `name` here to rename the app.
 */
export const SITE = {
  name: 'Couch',
  subtitle: 'Where to watch • Episode alerts',
  description:
    'Couch helps you find where movies and shows stream, compare plan prices, and keep up with new episodes. No account; everything stays on your device.',
  portalName: 'Horse Pocket',
  portalUrl: '../',
  makerName: 'Kale G.',
  makerUrl: 'https://github.com/mjolnir3286/horse_pocket',
  builtWith: 'Built with Grok Bot',
  tmdb: {
    notice: 'This product uses the TMDB API but is not endorsed or certified by TMDB.',
    url: 'https://www.themoviedb.org',
  },
  justwatchUrl: 'https://www.justwatch.com',
  attribution: {
    text: 'Show data: TVmaze (CC BY-SA 4.0)',
    sourceUrl: 'https://www.tvmaze.com',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
  },
  disclaimer:
    'Couch isn’t affiliated with any streaming service or data provider.',
} as const;
