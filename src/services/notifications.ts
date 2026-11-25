import { assetUrl, BASE_URL } from '../lib/baseUrl';

export type NotificationSupportState = NotificationPermission | 'unsupported';

export function getNotificationPermission(): NotificationSupportState {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }
  try {
    const registration = await navigator.serviceWorker.register(assetUrl('sw.js'), {
      scope: BASE_URL,
    });
    return registration;
  } catch {
    return null;
  }
}

export async function requestEpisodeNotificationPermission(): Promise<NotificationSupportState> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  const result = await Notification.requestPermission();
  return result;
}

export async function dispatchLocalEpisodeNotification(params: {
  title: string;
  body: string;
  tag?: string;
}): Promise<{ deliveredVia: 'service-worker' | 'window-notification' | 'in-app-only' }> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return { deliveredVia: 'in-app-only' };
  }
  if (Notification.permission !== 'granted') {
    return { deliveredVia: 'in-app-only' };
  }

  const icon = assetUrl('icons/icon-192.png');
  const watchlistUrl = `${BASE_URL}?tab=watchlist`;

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      if (reg && reg.showNotification) {
        await reg.showNotification(params.title, {
          body: params.body,
          icon,
          badge: icon,
          tag: params.tag || 'horse-pocket-episode',
          data: { url: watchlistUrl },
        });
        return { deliveredVia: 'service-worker' };
      }
    }
  } catch {
    // Fall back to direct Notification API
  }

  try {
    new Notification(params.title, {
      body: params.body,
      icon,
      tag: params.tag || 'horse-pocket-episode',
    });
    return { deliveredVia: 'window-notification' };
  } catch {
    return { deliveredVia: 'in-app-only' };
  }
}
