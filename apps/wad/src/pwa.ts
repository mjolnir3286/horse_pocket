const BASE_URL = import.meta.env.BASE_URL || '/'

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return null
  }
  try {
    const registration = await navigator.serviceWorker.register(`${BASE_URL}sw.js`, {
      scope: BASE_URL,
    })
    return registration
  } catch {
    return null
  }
}
