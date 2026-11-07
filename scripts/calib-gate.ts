import fs from 'node:fs'; import path from 'node:path'; import jpeg from 'jpeg-js';
import { extractFeatures, blur, SIZE } from '../src/services/biometric/featureMatcher';
const dir = path.resolve('public/demo');
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.jpg') && f !== 'hero.jpg').sort();
const gray = (f: string) => { const { width: w, height: h, data } = jpeg.decode(fs.readFileSync(path.join(dir, f)), { useTArray: true }); const o = new Float32Array(SIZE * SIZE);
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) { const sx = Math.min(w - 1, Math.floor((x + .5) / SIZE * w)), sy = Math.min(h - 1, Math.floor((y + .5) / SIZE * h)); const i = (sy * w + sx) * 4; o[y * SIZE + x] = .299 * data[i] + .587 * data[i + 1] + .114 * data[i + 2]; } return o; };
let seed = 3; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const kp = (g: Float32Array) => extractFeatures(g, SIZE, SIZE, 400).n;
const variants: Record<string, (g: Float32Array) => Float32Array> = {
  sharp: (g) => g,
  blur1_5: (g) => blur(g, SIZE, SIZE, 1.5), blur2_5: (g) => blur(g, SIZE, SIZE, 2.5), blur4: (g) => blur(g, SIZE, SIZE, 4),
  dark: (g) => g.map((v) => v * 0.2 + (rnd() - .5) * 6),
  tooSmall: (g) => { const o = new Float32Array(SIZE * SIZE).fill(120); const s = 0.35; for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) { const sx = (x - SIZE / 2) / s + SIZE / 2, sy = (y - SIZE / 2) / s + SIZE / 2; if (sx >= 0 && sy >= 0 && sx < SIZE && sy < SIZE) o[y * SIZE + x] = g[(sy | 0) * SIZE + (sx | 0)]; } return o; },
  flat: () => new Float32Array(SIZE * SIZE).fill(128).map((v) => v + (rnd() - .5) * 2),
};
const stats: Record<string, number[]> = {}; for (const k in variants) stats[k] = [];
for (const f of files) { const g = gray(f); for (const k in variants) stats[k].push(kp(variants[k](g))); }
for (const k in stats) { const a = stats[k].sort((x, y) => x - y); console.log(k.padEnd(9), 'min', a[0], 'median', a[a.length >> 1], 'max', a[a.length - 1]); }
