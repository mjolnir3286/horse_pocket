export interface PortalApp {
  id: string;
  name: string;
  path: string;
  category: string;
  description: string;
  cta: string;
  icon: 'couch' | 'wad';
}

export const PORTAL_META = {
  title: 'Horse Pocket',
  intro:
    'Open a tool below — everything runs in your browser, with no accounts.',
  makerName: 'Kale G.',
  makerUrl: 'https://github.com/mjolnir3286/horse_pocket',
  builtWith: 'Built with Grok Bot',
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
];
