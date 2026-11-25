/**
 * "Reset app data": clears only this app's own saved data on this device.
 *
 * Every Horse Pocket app shares one web origin (mjolnir3286.github.io), so this never calls
 * localStorage.clear() or deletes every cache. It removes only keys this app owns, only Cache
 * Storage entries with this app's prefix, and only the service worker registered for this app's
 * own folder, then reloads.
 */
export interface ResetPlan {
  /** True for localStorage / sessionStorage keys this app owns. */
  ownsKey: (key: string) => boolean;
  /** Cache Storage name prefix, e.g. "couch-". */
  cachePrefix: string;
  /** This app's base path, e.g. "/horse_pocket/couch/". */
  basePath: string;
  /** Optional extra cleanup (e.g. an IndexedDB entry). Failures are ignored. */
  extra?: () => Promise<void>;
}

function clearOwnKeys(storage: Storage | undefined, ownsKey: (key: string) => boolean): void {
  if (!storage) return;
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i);
    if (k !== null && ownsKey(k)) keys.push(k);
  }
  for (const k of keys) storage.removeItem(k);
}

export async function resetAppData(plan: ResetPlan, reload = true): Promise<void> {
  try {
    clearOwnKeys(window.localStorage, plan.ownsKey);
  } catch {
    // storage blocked
  }
  try {
    clearOwnKeys(window.sessionStorage, plan.ownsKey);
  } catch {
    // storage blocked
  }
  try {
    if ('caches' in window) {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n.startsWith(plan.cachePrefix)).map((n) => caches.delete(n)));
    }
  } catch {
    // Cache Storage unavailable
  }
  try {
    if ('serviceWorker' in navigator) {
      const scope = new URL(plan.basePath, window.location.origin).href;
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.filter((r) => r.scope === scope).map((r) => r.unregister()));
    }
  } catch {
    // no service worker support
  }
  if (plan.extra) {
    try {
      await plan.extra();
    } catch {
      // ignore
    }
  }
  if (reload) window.location.reload();
}

/** Backups above this size are refused before they are read. Real backups are far smaller. */
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
