/**
 * Pure image checks for the live camera guidance. No DOM access here, so they
 * run under `node --test` with synthetic pixel data. Limits live in
 * ../config/scanThresholds.ts.
 */
import { SCAN_THRESHOLDS, type ScanThresholds } from '../config/scanThresholds.ts';

export type ScanIssue = 'dark' | 'bright' | 'glare' | 'moving' | 'no-label' | 'blurry' | 'ok';

export interface FrameMetrics {
  /** Average brightness, 0–255. */
  brightness: number;
  /** Standard deviation of brightness, 0–127.5. */
  contrast: number;
  /** Share of blown-out pixels, 0–1. */
  glare: number;
  /**
   * Variance of the Laplacian divided by the brightness variance. Dividing out
   * contrast keeps the score about the same in dim and bright light, so only
   * focus and shake move it. Higher is sharper.
   */
  sharpness: number;
  /**
   * Mean absolute change per pixel since the previous check, after removing the
   * overall brightness shift (so auto-exposure changes don't count as moving).
   * Null on the first check.
   */
  motion: number | null;
}

/** Plain-language hint shown over the camera for each issue. */
export const SCAN_HINTS: Record<ScanIssue | 'starting', string> = {
  starting: 'Starting camera…',
  dark: 'Too dark. Find more light.',
  bright: 'Too bright. Move out of direct light.',
  glare: 'Glare on the label. Tilt the package a little.',
  moving: 'Hold steady.',
  'no-label': 'Line up the Nutrition Facts label in the frame.',
  blurry: 'Blurry. Hold still or move back a little.',
  ok: 'Looks good. Take the photo.',
};

/** RGBA pixels (as from getImageData) to one luma byte per pixel (Rec. 601 weights). */
export function toGray(rgba: ArrayLike<number>, width: number, height: number): Uint8Array {
  const n = width * height;
  const out = new Uint8Array(n);
  for (let p = 0, i = 0; p < n; p++, i += 4) {
    out[p] = (rgba[i] * 299 + rgba[i + 1] * 587 + rgba[i + 2] * 114 + 500) / 1000;
  }
  return out;
}

export function brightnessStats(gray: ArrayLike<number>): { mean: number; std: number } {
  const n = gray.length;
  if (n === 0) return { mean: 0, std: 0 };
  let sum = 0;
  let sumSq = 0;
  for (let i = 0; i < n; i++) {
    const v = gray[i];
    sum += v;
    sumSq += v * v;
  }
  const mean = sum / n;
  return { mean, std: Math.sqrt(Math.max(0, sumSq / n - mean * mean)) };
}

/** Share (0–1) of pixels at or above `level`. */
export function glareShare(gray: ArrayLike<number>, level: number): number {
  const n = gray.length;
  if (n === 0) return 0;
  let count = 0;
  for (let i = 0; i < n; i++) if (gray[i] >= level) count++;
  return count / n;
}

/** Variance of the 4-neighbour Laplacian over interior pixels. A standard focus measure. */
export function laplacianVariance(gray: ArrayLike<number>, width: number, height: number): number {
  if (width < 3 || height < 3) return 0;
  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (let y = 1; y < height - 1; y++) {
    const row = y * width;
    for (let x = 1; x < width - 1; x++) {
      const i = row + x;
      const lap = gray[i - width] + gray[i + width] + gray[i - 1] + gray[i + 1] - 4 * gray[i];
      sum += lap;
      sumSq += lap * lap;
      n++;
    }
  }
  const mean = sum / n;
  return Math.max(0, sumSq / n - mean * mean);
}

/**
 * Mean absolute per-pixel difference between two same-size frames after
 * removing the difference in their average brightness. Null if sizes differ.
 */
export function motionScore(prev: ArrayLike<number> | null | undefined, cur: ArrayLike<number>): number | null {
  if (!prev || prev.length !== cur.length || cur.length === 0) return null;
  const n = cur.length;
  let shift = 0;
  for (let i = 0; i < n; i++) shift += cur[i] - prev[i];
  shift /= n;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += Math.abs(cur[i] - prev[i] - shift);
  return sum / n;
}

/** Laplacian variance relative to brightness variance (focus measure that ignores light level). */
export function relativeSharpness(lapVariance: number, contrast: number): number {
  return lapVariance / Math.max(1, contrast * contrast);
}

export function measureFrame(
  gray: Uint8Array,
  width: number,
  height: number,
  previous: Uint8Array | null,
  t: Pick<ScanThresholds, 'GLARE_LEVEL'> = SCAN_THRESHOLDS
): FrameMetrics {
  const { mean, std } = brightnessStats(gray);
  return {
    brightness: mean,
    contrast: std,
    glare: glareShare(gray, t.GLARE_LEVEL),
    sharpness: relativeSharpness(laplacianVariance(gray, width, height), std),
    motion: motionScore(previous, gray),
  };
}

/**
 * The single most useful thing to fix, in priority order: light first (it
 * affects every other check), then glare, movement, framing, and focus.
 */
export function assessFrame(m: FrameMetrics, t: ScanThresholds = SCAN_THRESHOLDS): ScanIssue {
  if (m.brightness < t.MIN_BRIGHTNESS) return 'dark';
  if (m.brightness > t.MAX_BRIGHTNESS) return 'bright';
  if (m.glare > t.MAX_GLARE_SHARE) return 'glare';
  if (m.motion != null && m.motion > t.MAX_MOTION) return 'moving';
  if (m.contrast < t.MIN_CONTRAST) return 'no-label';
  if (m.sharpness < t.MIN_SHARPNESS) return 'blurry';
  return 'ok';
}

export interface HintState {
  /** Issue currently shown. */
  shown: ScanIssue | null;
  /** Latest raw issue and how many checks in a row reported it. */
  pending: ScanIssue | null;
  count: number;
}

export const initialHintState: HintState = { shown: null, pending: null, count: 0 };

/** Only switch the shown hint after `stable` checks in a row agree, so it doesn't flicker. */
export function nextHintState(state: HintState, issue: ScanIssue, stable: number = SCAN_THRESHOLDS.STABLE_SAMPLES): HintState {
  const count = state.pending === issue ? state.count + 1 : 1;
  const shown = state.shown === null || count >= stable ? issue : state.shown;
  return { shown, pending: issue, count };
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Map a rectangle in a displayed element's box to source-pixel coordinates when
 * the source is drawn with `object-fit: cover` (centered, scaled to fill,
 * overflow cropped). Result is clamped to the source.
 */
export function coverRectToSource(rect: Rect, elementW: number, elementH: number, srcW: number, srcH: number): Rect {
  const scale = Math.max(elementW / srcW, elementH / srcH);
  const offsetX = (elementW - srcW * scale) / 2;
  const offsetY = (elementH - srcH * scale) / 2;
  let x = (rect.x - offsetX) / scale;
  let y = (rect.y - offsetY) / scale;
  let width = rect.width / scale;
  let height = rect.height / scale;
  const x2 = Math.min(srcW, x + width);
  const y2 = Math.min(srcH, y + height);
  x = Math.max(0, x);
  y = Math.max(0, y);
  width = Math.max(0, x2 - x);
  height = Math.max(0, y2 - y);
  return { x, y, width, height };
}

/** A read worth retrying: few main values found, or many flagged unsure. */
export function isPoorRead(found: number, unsure: number, t: ScanThresholds = SCAN_THRESHOLDS): boolean {
  return found < t.POOR_READ_MIN_FOUND || unsure >= t.POOR_READ_MAX_UNSURE;
}
