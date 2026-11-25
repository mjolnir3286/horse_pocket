import './style.css';
import { PORTAL_APPS, PORTAL_META, type PortalApp } from './apps';

const BASE_URL = import.meta.env.BASE_URL || '/';

function appUrl(path: string): string {
  return `${BASE_URL}${path.replace(/^\//, '')}`;
}

function renderIcon(kind: PortalApp['icon']): string {
  if (kind === 'couch') {
    return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="6 4 20 12 6 20 6 4"/></svg>`;
  }
  return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/></svg>`;
}

const brandSvg = `<svg width="22" height="22" viewBox="0 0 64 64" aria-hidden="true">
  <rect x="10" y="10" width="18" height="18" rx="4" fill="currentColor" opacity="0.9"/>
  <rect x="36" y="10" width="18" height="18" rx="4" fill="#6366f1"/>
  <rect x="10" y="36" width="18" height="18" rx="4" fill="#6366f1"/>
  <rect x="36" y="36" width="18" height="18" rx="4" fill="currentColor" opacity="0.9"/>
</svg>`;

const arrowSvg = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>`;

const root = document.getElementById('app');
if (root) {
  const cardsHtml = PORTAL_APPS.map(
    (app) => `
      <a class="app-card" href="${appUrl(app.path)}">
        <div>
          <div class="app-card-top">
            <span class="app-icon">${renderIcon(app.icon)}</span>
            <span class="app-category">${app.category}</span>
          </div>
          <h2 class="app-name">${app.name}</h2>
          <p class="app-desc">${app.description}</p>
        </div>
        <span class="app-cta">${app.cta} ${arrowSvg}</span>
      </a>
    `
  ).join('');

  root.innerHTML = `
    <div class="portal-shell">
      <header class="portal-header">
        <div class="portal-brand">
          <div class="portal-mark">${brandSvg}</div>
          <div>
            <h1 class="portal-title">${PORTAL_META.title}</h1>
            <p class="portal-subtitle">${PORTAL_META.subtitle}</p>
          </div>
        </div>
      </header>

      <main class="portal-main">
        <p class="portal-intro">${PORTAL_META.intro}</p>
        <section class="app-grid" aria-label="Mini apps">
          ${cardsHtml}
        </section>
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
