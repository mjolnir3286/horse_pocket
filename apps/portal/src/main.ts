import './style.css';
import { PORTAL_APPS, PORTAL_META, type PortalApp } from './apps';

const BASE_URL = import.meta.env.BASE_URL || '/';

function appUrl(path: string): string {
  return `${BASE_URL}${path.replace(/^\//, '')}`;
}

const horsePocketSvg = `<svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
  <defs>
    <clipPath id="portal-hp-clip">
      <polygon points="11.5,3.5 52.5,3.5 60.5,11.5 60.5,52.5 52.5,60.5 11.5,60.5 3.5,52.5 3.5,11.5"/>
    </clipPath>
  </defs>
  <polygon points="11.5,3.5 52.5,3.5 60.5,11.5 60.5,52.5 52.5,60.5 11.5,60.5 3.5,52.5 3.5,11.5" fill="var(--hp-bg)"/>
  <g clip-path="url(#portal-hp-clip)">
    <path d="M25.5 14 C33.5 10.5, 43.5 12.8, 49.5 18 L46 19.5 C51 21.5, 54.5 25.5, 55.5 31 L51.5 31.5 C54.5 35.5, 56 40.5, 55.5 46 L52 45.5 C54 50, 54.5 55, 54.5 60.5 L42 60.5 C39.5 52.5, 37.5 46, 34 40 C34.5 31.5, 33 22, 25.5 14 Z" fill="currentColor"/>
    <path d="M16.5 14.5 C19.5 13.5, 24 13.5, 27 16 L24.5 20.5 C21.5 19.5, 17.5 20.5, 14.5 23.5 C14.5 19.5, 15 16.5, 16.5 14.5 Z" fill="currentColor"/>
    <path d="M15.2 17.5 L14 8 L20.8 14.2" fill="var(--hp-bg)" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M21 15 L24.5 7 L28.5 16" fill="var(--hp-bg)" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M15.5 19.2 C13.5 22.5, 13 24.5, 13.8 26.5 C12.2 31.5, 10.8 36.8, 10.4 40.2 C10 44.4, 12.2 48.2, 16.5 48.8 C20.8 49.4, 25.6 47.8, 29.6 44.6 C33.2 41.6, 35 37.4, 35 31.8 C35 26, 33 20.5, 29 16.5" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M31.2 43.8 L42.5 60.5" stroke="currentColor" stroke-width="4.2" stroke-linecap="round"/>
    <path d="M20.5 26.8 C22.8 24.6, 26.5 24.6, 28.2 26.4 C26.4 28.6, 22.8 28.8, 20.5 26.8 Z" fill="currentColor"/>
    <path d="M13.8 40.2 C14.8 39.8, 16.2 40.6, 15.8 42.1" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/>
    <path d="M14.2 45.8 C15.8 46.2, 17.4 45.6, 18.8 44.4" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
  </g>
  <polygon points="11.5,3.5 52.5,3.5 60.5,11.5 60.5,52.5 52.5,60.5 11.5,60.5 3.5,52.5 3.5,11.5" stroke="currentColor" stroke-width="5" stroke-linejoin="miter"/>
</svg>`;

const couchIconSvg = `<svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
  <path fill="var(--couch-outline)" d="M12.8 45.2 L10.2 54.4 C10 55.2 11 55.7 11.7 55 L17.4 46.4 Z"/>
  <path fill="var(--couch-outline)" d="M51.2 45.2 L53.8 54.4 C54 55.2 53 55.7 52.3 55 L46.6 46.4 Z"/>
  <path fill="var(--couch-fill)" stroke="var(--couch-outline)" d="M10.5 24 C16 13, 48 13, 53.5 24 L56 42.5 C56 46, 52 47, 46 47 C36.5 45.8, 27.5 45.8, 18 47 C12 47, 8 46, 8 42.5 Z" stroke-width="3.8" stroke-linejoin="round"/>
  <path fill="var(--couch-fill)" stroke="var(--couch-outline)" d="M9.5 21.5 C5.6 21.5, 4.4 26.5, 5.4 35.5 C6.2 42.8, 8.8 46.8, 14.5 46.8 L13.2 28 C12.8 24, 11.6 21.5, 9.5 21.5 Z" stroke-width="3.8" stroke-linejoin="round"/>
  <path fill="var(--couch-fill)" stroke="var(--couch-outline)" d="M54.5 21.5 C58.4 21.5, 59.6 26.5, 58.6 35.5 C57.8 42.8, 55.2 46.8, 49.5 46.8 L50.8 28 C51.2 24, 52.4 21.5, 54.5 21.5 Z" stroke-width="3.8" stroke-linejoin="round"/>
  <rect fill="var(--couch-fill)" stroke="var(--couch-outline)" x="13.5" y="30.5" width="18.5" height="11.8" rx="3.4" stroke-width="3.4" stroke-linejoin="round"/>
  <rect fill="var(--couch-fill)" stroke="var(--couch-outline)" x="32" y="30.5" width="18.5" height="11.8" rx="3.4" stroke-width="3.4" stroke-linejoin="round"/>
</svg>`;

const shedIconSvg = `<svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
  <polygon fill="var(--shed-outline)" points="4,12 12,4 52,4 60,12 60,52 52,60 12,60 4,52"/>
  <path fill="var(--shed-fill)" d="M8 12 L12 8 L52 8 L56 12 L56 52 L52 56 L12 56 L8 52 Z"/>
  <rect fill="var(--shed-outline)" x="10" y="19" width="44" height="6"/>
  <rect fill="var(--shed-outline)" x="10" y="32" width="44" height="6"/>
  <rect fill="var(--shed-outline)" x="10" y="41" width="44" height="2"/>
  <rect fill="var(--shed-outline)" x="10" y="46" width="44" height="2"/>
  <rect fill="var(--shed-outline)" x="10" y="50" width="44" height="2"/>
</svg>`;

function renderTileIcon(kind: PortalApp['icon']): string {
  if (kind === 'couch') return couchIconSvg;
  if (kind === 'shed') return shedIconSvg;
  return `<img class="app-tile-img" src="${appUrl('wad-icon.png')}" alt="" width="68" height="68" />`;
}

const root = document.getElementById('app');
if (root) {
  const tilesHtml = PORTAL_APPS.map(
    (app) => `
      <a class="app-tile" href="${appUrl(app.path)}" title="${app.name} — ${app.category}">
        <span class="app-tile-icon">${renderTileIcon(app.icon)}</span>
        <span class="app-tile-name">${app.name}</span>
      </a>
    `
  ).join('');

  root.innerHTML = `
    <div class="portal-shell">
      <header class="portal-header">
        <div class="portal-brand">
          <div class="portal-mark">${horsePocketSvg}</div>
          <div>
            <h1 class="portal-title">${PORTAL_META.title}</h1>
          </div>
        </div>
      </header>

      <main class="portal-main">
        <p class="portal-intro">${PORTAL_META.intro}</p>
        <nav class="launcher-grid" aria-label="Apps">
          ${tilesHtml}
        </nav>
      </main>

      <footer class="portal-footer">
        <div class="portal-footer-credits">
          <span>Made by <a href="${PORTAL_META.makerUrl}" target="_blank" rel="noopener noreferrer">${PORTAL_META.makerName}</a></span>
          <span aria-hidden="true">·</span>
          <span>${PORTAL_META.builtWith}</span>
        </div>
        <span>Client-side apps · No accounts</span>
      </footer>
    </div>
  `;
}
