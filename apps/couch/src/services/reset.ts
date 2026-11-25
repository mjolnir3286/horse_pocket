import { BASE_URL } from '../lib/baseUrl';
import type { ResetPlan } from '../lib/resetAppData';

/** Older Couch keys that predate the couch_ prefix. Other apps never use these names. */
const LEGACY_COUCH_KEYS = new Set([
  'horse_pocket_upcoming_status_v1',
  'horse_pocket_upcoming_platforms_v1',
  'horse_pocket_upcoming_sort_v1',
  'horse_pocket_welcome_dismissed_v1',
  'horse_pocket_followed_leads_v1',
  'horse_pocket_premium_preview_v1',
  'horse_pocket_watchlist_v2',
]);

export const COUCH_RESET_PLAN: ResetPlan = {
  ownsKey: (key) => key.startsWith('couch_') || LEGACY_COUCH_KEYS.has(key),
  cachePrefix: 'couch-',
  basePath: BASE_URL,
};
