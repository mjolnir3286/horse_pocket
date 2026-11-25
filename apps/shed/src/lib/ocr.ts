/**
 * On-device label reading with Tesseract.js.
 * Tesseract, its WebAssembly core, and the English model are copied into
 * public/ocr/ at build time (scripts/copy-ocr-assets.mjs) and served from this
 * site, so scanning never calls a third-party server. Loaded only on first scan.
 */
import type { Worker } from 'tesseract.js';
import { absoluteAssetUrl } from './baseUrl';

export interface OcrProgress {
  status: string;
  progress: number;
}

let workerPromise: Promise<Worker> | null = null;
let progressListener: ((p: OcrProgress) => void) | null = null;

const STATUS_TEXT: Record<string, string> = {
  'loading tesseract core': 'Loading reader',
  'initializing tesseract': 'Starting reader',
  'loading language traineddata': 'Loading English model',
  'loaded language traineddata': 'Loading English model',
  'initializing api': 'Starting reader',
  'recognizing text': 'Reading label',
};

async function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker, OEM, PSM } = await import('tesseract.js');
      const worker = await createWorker('eng', OEM.LSTM_ONLY, {
        workerPath: absoluteAssetUrl('ocr/worker.min.js'),
        corePath: absoluteAssetUrl('ocr/core/'),
        langPath: absoluteAssetUrl('ocr/lang'),
        workerBlobURL: false,
        logger: (m: { status: string; progress: number }) => {
          progressListener?.({ status: STATUS_TEXT[m.status] ?? 'Working', progress: m.progress ?? 0 });
        },
      });
      await worker.setParameters({
        tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
        preserve_interword_spaces: '1',
      });
      return worker;
    })();
    workerPromise.catch(() => {
      workerPromise = null;
    });
  }
  return workerPromise;
}

/**
 * Downscale, convert to grayscale, and stretch contrast. Labels are black on
 * white, so this helps OCR on dim or tinted photos and keeps memory in check.
 */
async function prepareImage(file: Blob): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file);
  const maxSide = 2000;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();

  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const hist = new Uint32Array(256);
  for (let i = 0; i < d.length; i += 4) {
    const g = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
    d[i] = g;
    hist[g]++;
  }
  // stretch between the 2nd and 98th percentiles
  const total = w * h;
  let lo = 0;
  let hi = 255;
  for (let acc = 0, v = 0; v < 256; v++) {
    acc += hist[v];
    if (acc >= total * 0.02) {
      lo = v;
      break;
    }
  }
  for (let acc = 0, v = 255; v >= 0; v--) {
    acc += hist[v];
    if (acc >= total * 0.02) {
      hi = v;
      break;
    }
  }
  const range = Math.max(1, hi - lo);
  for (let i = 0; i < d.length; i += 4) {
    const v = Math.max(0, Math.min(255, ((d[i] - lo) * 255) / range));
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

export async function readLabelText(file: Blob, onProgress?: (p: OcrProgress) => void): Promise<string> {
  progressListener = onProgress ?? null;
  try {
    onProgress?.({ status: 'Preparing photo', progress: 0 });
    const canvas = await prepareImage(file);
    const worker = await getWorker();
    const { data } = await worker.recognize(canvas);
    return data.text ?? '';
  } finally {
    progressListener = null;
  }
}
