import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  assessFrame,
  brightnessStats,
  coverRectToSource,
  glareShare,
  initialHintState,
  isPoorRead,
  laplacianVariance,
  measureFrame,
  motionScore,
  nextHintState,
  relativeSharpness,
  toGray,
} from './frameAnalysis.ts';
import { SCAN_THRESHOLDS } from '../config/scanThresholds.ts';

const W = 240;
const H = 352;

/** Deterministic pseudo-random numbers so tests are stable. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

/**
 * Synthetic label: light paper with rows of dark "glyph" strokes and a few
 * thick rules, plus a little sensor noise. Roughly what the frame crop sees.
 */
function syntheticLabel({ paper = 200, ink = 45, noise = 3, seed = 7, offsetX = 0 } = {}): Uint8Array {
  const r = rng(seed);
  const g = new Uint8Array(W * H);
  g.fill(paper);
  const glyph = rng(99); // same text layout for every frame
  for (let row = 10; row < H - 12; row += 16) {
    const thick = row % 96 === 10;
    for (let x = 8; x < W - 8; ) {
      const wGlyph = thick ? W : 2 + Math.floor(glyph() * 3);
      const hGlyph = thick ? 5 : 9;
      for (let y = row; y < row + hGlyph; y++) {
        for (let dx = 0; dx < wGlyph && x + dx < W - 8; dx++) {
          const xx = x + dx + offsetX;
          if (xx >= 0 && xx < W) g[y * W + xx] = ink;
        }
      }
      x += wGlyph + 2 + Math.floor(glyph() * 3);
    }
  }
  for (let i = 0; i < g.length; i++) g[i] = clamp(g[i] + (r() - 0.5) * 2 * noise);
  return g;
}

const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
const scale = (g: Uint8Array, k: number, add = 0) => g.map((v) => clamp(v * k + add));

function boxBlur(g: Uint8Array, radius: number): Uint8Array {
  let src = g;
  for (let pass = 0; pass < 2; pass++) {
    const out = new Uint8Array(src.length);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let sum = 0;
        let n = 0;
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const yy = y + dy;
            const xx = x + dx;
            if (yy < 0 || yy >= H || xx < 0 || xx >= W) continue;
            sum += src[yy * W + xx];
            n++;
          }
        }
        out[y * W + x] = Math.round(sum / n);
      }
    }
    src = out;
  }
  return src;
}

function withGlare(g: Uint8Array, cx: number, cy: number, radius: number): Uint8Array {
  const out = new Uint8Array(g);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const d2 = (x - cx) ** 2 + (y - cy) ** 2;
      out[y * W + x] = clamp(g[y * W + x] + 240 * Math.exp(-d2 / (2 * radius * radius)));
    }
  }
  return out;
}

const assess = (g: Uint8Array, prev: Uint8Array | null = null) => assessFrame(measureFrame(g, W, H, prev));

test('toGray uses luma weights on RGBA input', () => {
  const rgba = new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255]);
  assert.deepEqual(Array.from(toGray(rgba, 2, 2)), [76, 150, 29, 255]);
});

test('brightnessStats and glareShare', () => {
  const half = new Uint8Array(100);
  half.fill(0, 0, 50);
  half.fill(200, 50);
  const s = brightnessStats(half);
  assert.equal(s.mean, 100);
  assert.equal(s.std, 100);
  assert.equal(brightnessStats(new Uint8Array(0)).mean, 0);
  const g = new Uint8Array([10, 249, 250, 255]);
  assert.equal(glareShare(g, 250), 0.5);
});

test('Laplacian variance: flat is zero, edges are high, blur lowers it', () => {
  assert.equal(laplacianVariance(new Uint8Array(W * H).fill(128), W, H), 0);
  const label = syntheticLabel({ noise: 0 });
  const sharp = laplacianVariance(label, W, H);
  const blurred = laplacianVariance(boxBlur(label, 1), W, H);
  assert.ok(sharp > 1000, `sharp ${sharp}`);
  assert.ok(blurred < sharp / 4, `blurred ${blurred} vs ${sharp}`);
  assert.equal(laplacianVariance(new Uint8Array(4), 2, 2), 0);
});

test('relative sharpness stays about the same in dim light', () => {
  const bright = measureFrame(syntheticLabel(), W, H, null);
  const dim = measureFrame(scale(syntheticLabel(), 0.5), W, H, null);
  assert.ok(Math.abs(bright.sharpness - dim.sharpness) / bright.sharpness < 0.25, `${bright.sharpness} vs ${dim.sharpness}`);
  assert.equal(relativeSharpness(100, 0), 100);
});

test('motion: still frames and exposure changes are not movement, a shift is', () => {
  const a = syntheticLabel({ seed: 1 });
  const b = syntheticLabel({ seed: 2 }); // same scene, new sensor noise
  assert.ok(motionScore(a, b)! < 3);
  assert.ok(motionScore(a, scale(a, 1, 25))! < 1, 'uniform brightness shift is ignored');
  assert.ok(motionScore(a, syntheticLabel({ seed: 2, offsetX: 3 }))! > SCAN_THRESHOLDS.MAX_MOTION);
  assert.equal(motionScore(null, a), null);
  assert.equal(motionScore(a, new Uint8Array(10)), null);
});

test('a clear, steady label passes', () => {
  const prev = syntheticLabel({ seed: 1 });
  assert.equal(assess(syntheticLabel({ seed: 2 }), prev), 'ok');
  // dim kitchen light is still fine
  assert.equal(assess(scale(syntheticLabel(), 0.5)), 'ok');
});

test('too dark and too bright', () => {
  assert.equal(assess(scale(syntheticLabel(), 0.25)), 'dark');
  assert.equal(assess(scale(syntheticLabel(), 1.1, 50)), 'bright');
});

test('glare from a blown-out spot', () => {
  assert.equal(assess(withGlare(syntheticLabel(), 120, 150, 45)), 'glare');
  // a tiny highlight is tolerated
  assert.equal(assess(withGlare(syntheticLabel(), 120, 150, 6)), 'ok');
});

test('blurry label', () => {
  assert.equal(assess(boxBlur(syntheticLabel({ noise: 0 }), 2)), 'blurry');
});

test('moving camera', () => {
  const prev = syntheticLabel({ seed: 1 });
  assert.equal(assess(syntheticLabel({ seed: 2, offsetX: 4 }), prev), 'moving');
});

test('blank surface asks to line up the label', () => {
  const blank = new Uint8Array(W * H).fill(150);
  assert.equal(assess(blank), 'no-label');
});

test('darkness wins over other problems', () => {
  assert.equal(assess(scale(boxBlur(syntheticLabel(), 2), 0.25)), 'dark');
});

test('hint only changes after consecutive agreeing checks', () => {
  let s = nextHintState(initialHintState, 'dark', 2);
  assert.equal(s.shown, 'dark', 'first result shows right away');
  s = nextHintState(s, 'ok', 2);
  assert.equal(s.shown, 'dark');
  s = nextHintState(s, 'blurry', 2);
  assert.equal(s.shown, 'dark');
  s = nextHintState(s, 'blurry', 2);
  assert.equal(s.shown, 'blurry');
});

test('coverRectToSource maps the frame onto camera pixels', () => {
  // 1280x720 camera shown with object-fit: cover in a 360x800 portrait box.
  // scale = 800/720, so the box shows the middle 324 source px horizontally.
  const r = coverRectToSource({ x: 40, y: 200, width: 280, height: 400 }, 360, 800, 1280, 720);
  const k = 720 / 800;
  assert.ok(Math.abs(r.x - (640 - 180 * k + 40 * k)) < 1e-6);
  assert.ok(Math.abs(r.y - 200 * k) < 1e-6);
  assert.ok(Math.abs(r.width - 280 * k) < 1e-6);
  assert.ok(Math.abs(r.height - 400 * k) < 1e-6);
  // clamped to the source
  const c = coverRectToSource({ x: -50, y: -50, width: 1000, height: 1000 }, 100, 100, 100, 100);
  assert.deepEqual(c, { x: 0, y: 0, width: 100, height: 100 });
});

test('poor read detection', () => {
  assert.equal(isPoorRead(5, 0), false);
  assert.equal(isPoorRead(2, 0), true);
  assert.equal(isPoorRead(5, 3), true);
});
