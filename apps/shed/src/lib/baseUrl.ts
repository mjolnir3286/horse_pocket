export const BASE_URL = import.meta.env.BASE_URL;

export function assetUrl(path: string): string {
  return `${BASE_URL}${path.replace(/^\//, '')}`;
}

/** Absolute URL for an asset, needed inside workers that resolve paths differently. */
export function absoluteAssetUrl(path: string): string {
  return new URL(assetUrl(path), window.location.href).href;
}
