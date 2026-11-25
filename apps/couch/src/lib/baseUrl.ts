/** Vite base path, e.g. "/horse_pocket/" on GitHub Pages. */
export const BASE_URL = import.meta.env.BASE_URL || '/';

export function assetUrl(path: string): string {
  const trimmed = path.replace(/^\//, '');
  return `${BASE_URL}${trimmed}`;
}
