/** Site title, credits, and maker info. */
export const SITE = {
  name: 'Shed',
  description:
    'Shed reads nutrition labels with your camera, works out what you actually ate, and keeps a simple daily log against a calorie target. No account; everything stays on your device.',
  portalName: 'Horse Pocket',
  portalUrl: '../',
  makerName: 'Kale G.',
  makerUrl: 'https://github.com/mjolnir3286/horse_pocket',
  builtWith: 'Built with Grok Bot',
  credits: [
    { text: 'Label reading: Tesseract.js (Apache 2.0)', url: 'https://github.com/naptha/tesseract.js' },
    { text: 'Icons: Lucide (ISC)', url: 'https://lucide.dev' },
  ],
  formulaNote: 'Daily target: Mifflin-St Jeor equation with standard activity factors.',
  disclaimer:
    'Shed gives estimates for general information, not medical or nutrition advice. Talk to a doctor or registered dietitian before big changes, especially if you are pregnant, under 18, or have a health condition.',
} as const;
