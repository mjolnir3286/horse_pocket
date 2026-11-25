/**
 * Site title, credits, and maker info — edit `name` here to rename the app.
 */
export const SITE = {
  name: 'Couch',
  description:
    'Couch helps you browse upcoming releases, find where movies and shows stream, see what’s popular on your services, and keep up with new episodes. No account; everything stays on your device.',
  portalName: 'Horse Pocket',
  portalUrl: '../',
  makerName: 'Kale G.',
  makerUrl: 'https://github.com/mjolnir3286/horse_pocket',
  builtWith: 'Built with Grok Bot',
  devNotice:
    'These apps are in active development, so expect occasional bugs and changes.',
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
    'Couch isn’t affiliated with any streaming platform or data source.',
} as const;
