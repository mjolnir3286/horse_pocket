import { createContext, useContext } from 'react';
import { isPlatformId, PLATFORMS } from '../data/platforms';
import type { PlatformId } from '../types/streaming';

/** Services the user marked as theirs on the Platforms tab (issue #5). Local only. */
export const MY_SERVICES_KEY = 'couch_my_services_v1';

export const isMyServicesList = (value: unknown): value is PlatformId[] =>
  Array.isArray(value) && value.every(isPlatformId);

/** Keep known ids only, de-duplicated, in Platforms-tab order. */
export function sanitizeMyServices(value: unknown): PlatformId[] {
  if (!Array.isArray(value)) return [];
  const set = new Set(value.filter(isPlatformId));
  return PLATFORMS.map((p) => p.id).filter((id) => set.has(id));
}

export function loadMyServices(): PlatformId[] {
  try {
    const raw = localStorage.getItem(MY_SERVICES_KEY);
    return raw ? sanitizeMyServices(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

export function saveMyServices(ids: PlatformId[]) {
  try {
    if (ids.length === 0) localStorage.removeItem(MY_SERVICES_KEY);
    else localStorage.setItem(MY_SERVICES_KEY, JSON.stringify(ids));
  } catch {
    // ignore quota / private-mode failures
  }
}

/** TMDB provider ids covered by the given services. */
export function providerIdsFor(ids: PlatformId[]): Set<number> {
  const set = new Set<number>();
  for (const p of PLATFORMS) if (ids.includes(p.id)) for (const pid of p.tmdbProviderIds) set.add(pid);
  return set;
}

export interface MyServicesValue {
  ids: PlatformId[];
  providerIds: Set<number>;
}

export const MyServicesContext = createContext<MyServicesValue>({ ids: [], providerIds: new Set() });

export const useMyServices = () => useContext(MyServicesContext);
