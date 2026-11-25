import { BASE_URL } from './baseUrl';
import { OCR_IDB_CACHE_PATH } from './ocr';
import type { ResetPlan } from './resetAppData';

/**
 * Tesseract keeps the English model in IndexedDB ("keyval-store" / "keyval"). Delete only
 * Shed's entries: its own cache path, plus the older default "./" key only Shed ever wrote.
 */
async function clearOcrModelCache(): Promise<void> {
  if (!('indexedDB' in window)) return;
  const dbs = indexedDB.databases ? await indexedDB.databases() : null;
  if (dbs && !dbs.some((d) => d.name === 'keyval-store')) return;
  await new Promise<void>((resolve) => {
    const req = indexedDB.open('keyval-store');
    req.onerror = () => resolve();
    req.onsuccess = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('keyval')) {
        db.close();
        resolve();
        return;
      }
      const tx = db.transaction('keyval', 'readwrite');
      const store = tx.objectStore('keyval');
      store.delete(`${OCR_IDB_CACHE_PATH}/eng.traineddata`);
      store.delete('./eng.traineddata');
      tx.oncomplete = tx.onerror = tx.onabort = () => {
        db.close();
        resolve();
      };
    };
  });
}

export const SHED_RESET_PLAN: ResetPlan = {
  ownsKey: (key) => key.startsWith('shed_'),
  cachePrefix: 'shed-',
  basePath: BASE_URL,
  extra: clearOcrModelCache,
};
