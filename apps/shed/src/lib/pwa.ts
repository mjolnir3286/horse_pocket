/**
 * Reusable PWA helpers (service worker + install prompt).
 * Self-contained so another Horse Pocket app (e.g. Wad) can copy this file,
 * its public/sw.js, and public/manifest.webmanifest as-is, changing only names.
 */
import { useCallback, useEffect, useState } from 'react';
import { assetUrl, BASE_URL } from './baseUrl';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null;
  if (import.meta.env.DEV) return null;
  try {
    return await navigator.serviceWorker.register(assetUrl('sw.js'), { scope: BASE_URL });
  } catch {
    return null;
  }
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes('Mac') && 'ontouchend' in document);
}

export type InstallOutcome = 'accepted' | 'dismissed' | 'installed' | 'manual';

/** Tracks the browser's install prompt. `install()` falls back to instructions text. */
export function useInstallPrompt(appName: string) {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState<boolean>(isStandalone());

  useEffect(() => {
    const onBefore = (e: Event) => {
      e.preventDefault();
      setPromptEvent(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
    };
    window.addEventListener('beforeinstallprompt', onBefore);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBefore);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const manualInstructions = isIos()
    ? `To install ${appName}: tap Share, then “Add to Home Screen”.`
    : `To install ${appName}: open your browser menu and choose “Install app” or “Add to Home screen”.`;

  const install = useCallback(async (): Promise<{ outcome: InstallOutcome; message: string }> => {
    if (installed) return { outcome: 'installed', message: `${appName} is already installed on this device.` };
    if (!promptEvent) return { outcome: 'manual', message: manualInstructions };
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    setPromptEvent(null);
    return choice.outcome === 'accepted'
      ? { outcome: 'accepted', message: `Installing ${appName}…` }
      : { outcome: 'dismissed', message: 'Install canceled.' };
  }, [appName, installed, manualInstructions, promptEvent]);

  return { canPrompt: promptEvent !== null, installed, install };
}
