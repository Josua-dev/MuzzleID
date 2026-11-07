import fs from 'node:fs'; import path from 'node:path'; import jpeg from 'jpeg-js';
import { extractFeatures, matchFeatures, SIZE } from '../src/services/biometric/featureMatcher';
const dir = path.resolve('public/demo');
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.jpg') && f !== 'hero.jpg').sort();
const gray = (f: string) => { const { width: w, height: h, data } = jpeg.decode(fs.readFileSync(path.join(dir, f)), { useTArray: true });
  const o = new Float32Array(SIZE * SIZE);
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) { const sx = Math.min(w - 1, Math.floor((x + .5) / SIZE * w)), sy = Math.min(h - 1, Math.floor((y + .5) / SIZE * h)); const i = (sy * w + sx) * 4; o[y * SIZE + x] = .299 * data[i] + .587 * data[i + 1] + .114 * data[i + 2]; } return o; };
const F = files.map((f) => extractFeatures(gray(f)));
for (let i = 0; i < files.length; i++) for (let j = i + 1; j < files.length; j++) { const s = matchFeatures(F[i], F[j]).inliers; if (s >= 15) console.log(files[i], files[j], s); }
console.log('done');
