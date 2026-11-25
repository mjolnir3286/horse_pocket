/**
 * Live camera guidance limits for the label scanner.
 *
 * These are the only numbers to change when tuning the camera hints. They are
 * starting values picked from sample label photos (a real phone shot plus
 * darkened, overexposed, glare, blurred, and shaken versions of it). Tune them
 * on the live app from real-phone feedback.
 *
 * All values are measured on a small grayscale copy of the area inside the
 * alignment frame (see ANALYSIS_WIDTH), with brightness on a 0–255 scale.
 */
export const SCAN_THRESHOLDS = {
  /** Width in pixels of the downscaled frame crop the checks run on. */
  ANALYSIS_WIDTH: 240,
  /** How often the checks run while aiming, in milliseconds (about 4 per second). */
  ANALYSIS_INTERVAL_MS: 250,

  /** Average brightness below this is "too dark". Paper under kitchen light sits around 120–200. */
  MIN_BRIGHTNESS: 70,
  /** Average brightness above this is "too bright" (washed out, text loses contrast). */
  MAX_BRIGHTNESS: 205,

  /** A pixel at or above this brightness counts as blown out (glare). */
  GLARE_LEVEL: 250,
  /** Glare warning when more than this share of pixels is blown out (0–1). */
  MAX_GLARE_SHARE: 0.06,

  /** Spread of brightness (standard deviation) below this means no label text in view. */
  MIN_CONTRAST: 18,

  /**
   * Edge strength (Laplacian variance ÷ brightness variance) below this is
   * "blurry". A sharp label scores about 0.8; reads start failing near 0.12.
   */
  MIN_SHARPNESS: 0.15,

  /**
   * Mean absolute change per pixel between checks above this is "moving".
   * Sensor noise alone is about 1; a 1-pixel shift of a sharp label is about 6.
   */
  MAX_MOTION: 8,

  /** Consecutive matching checks before a hint changes, so it doesn't flicker. */
  STABLE_SAMPLES: 2,
  /** Minimum time between screen reader announcements of the hint, in milliseconds. */
  ANNOUNCE_INTERVAL_MS: 3000,

  /** After a read, show the "try again" tips when fewer main values than this were found... */
  POOR_READ_MIN_FOUND: 4,
  /** ...or when at least this many fields were flagged unsure. */
  POOR_READ_MAX_UNSURE: 3,
} as const;

export type ScanThresholds = typeof SCAN_THRESHOLDS;

/** Shape of the alignment frame (width / height). The top of a US label is taller than wide. */
export const FRAME_ASPECT = 0.68;
