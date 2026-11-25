// Copy Tesseract.js worker, WebAssembly cores, and the English model into
// public/ocr/ so the app serves them itself (no CDN). public/ocr/ is gitignored
// and rebuilt on every `npm run dev` / `npm run build`.
import { copyFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'public', 'ocr');

const tesseractDir = dirname(require.resolve('tesseract.js/package.json'));
const coreDir = dirname(require.resolve('tesseract.js-core/package.json'));
const langDir = dirname(require.resolve('@tesseract.js-data/eng/package.json'));

// LSTM-only cores (we run OEM.LSTM_ONLY). Tesseract picks one by browser support.
const cores = [
  'tesseract-core-lstm.wasm.js',
  'tesseract-core-simd-lstm.wasm.js',
  'tesseract-core-relaxedsimd-lstm.wasm.js',
];

rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, 'core'), { recursive: true });
mkdirSync(join(out, 'lang'), { recursive: true });

copyFileSync(join(tesseractDir, 'dist', 'worker.min.js'), join(out, 'worker.min.js'));
for (const f of cores) copyFileSync(join(coreDir, f), join(out, 'core', f));

// "best_int" English model: LSTM-only, ~3 MB gzipped, good accuracy for printed labels.
const lang = join(langDir, '4.0.0_best_int', 'eng.traineddata.gz');
if (!existsSync(lang)) throw new Error(`Missing ${lang}`);
copyFileSync(lang, join(out, 'lang', 'eng.traineddata.gz'));

console.log('OCR assets copied to public/ocr/');
