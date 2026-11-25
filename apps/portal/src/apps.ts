export interface PortalApp {
  id: string;
  name: string;
  path: string;
  category: string;
  description: string;
  cta: string;
  icon: 'couch' | 'wad' | 'shed';
}

export const PORTAL_META = {
  title: 'Horse Pocket',
  intro:
    'Open a tool below — everything runs in your browser, with no accounts.',
  makerName: 'Kale G.',
  makerUrl: 'https://github.com/mjolnir3286/horse_pocket',
  builtWith: 'Built with Grok Bot',
  devNotice:
    'These apps are in active development, so expect occasional bugs and changes.',
  reportIssueUrl:
    'https://github.com/mjolnir3286/horse_pocket/issues/new?title=Feedback%3A%20',
  reportIssueLabel: 'Report an issue',
  reportIssueNote:
    "Needs a GitHub account. Posts are public, so don't include personal details.",
} as const;

export const PORTAL_APPS: readonly PortalApp[] = [
  {
    id: 'couch',
    name: 'Couch',
    path: 'couch/',
    category: 'Streaming & Alerts',
    description:
      'Find where shows and movies stream, compare example platform plans, and track upcoming episodes.',
    cta: 'Open Couch',
    icon: 'couch',
  },
  {
    id: 'wad',
    name: 'Wad',
    path: 'wad/',
    category: 'Budget & Planning',
    description:
      'Estimate take-home pay, taxes, expenses, and savings goals with local CSV export and import.',
    cta: 'Open Wad',
    icon: 'wad',
  },
  {
    id: 'shed',
    name: 'Shed',
    path: 'shed/',
    category: 'Nutrition & Calories',
    description:
      'Scan nutrition labels on your device, work out what you ate, and log calories against a daily target.',
    cta: 'Open Shed',
    icon: 'shed',
  },
];
