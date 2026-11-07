// Synthetic robustness benchmark for the muzzle matcher.
// Each demo image is one identity. Probes are the SAME photo re-framed/rotated/relit/blurred/noised,
// so this measures robustness to capture conditions, NOT true re-photography of a living animal.
import fs from 'node:fs';
import path from 'node:path';
import jpeg from 'jpeg-js';
import { extractFeatures, matchFeatures, SIZE, type FeatureSet } from '../src/services/biometric/featureMatcher';

const dir = path.resolve('public/demo');
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.jpg') && f !== 'hero.jpg').sort();

function rng(seed: number) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const gauss = (r: () => number) => Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r());

interface Src { w: number; h: number; g: Float32Array }
const load = (f: string): Src => {
  const { width: w, height: h, data } = jpeg.decode(fs.readFileSync(path.join(dir, f)), { useTArray: true });
  const g = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) g[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
  return { w, h, g };
};
const sample = (s: Src, x: number, y: number) => {
  x = Math.min(s.w - 1.001, Math.max(0, x)); y = Math.min(s.h - 1.001, Math.max(0, y));
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0, i = y0 * s.w + x0;
  return (s.g[i] * (1 - fx) + s.g[i + 1] * fx) * (1 - fy) + (s.g[i + s.w] * (1 - fx) + s.g[i + s.w + 1] * fx) * fy;
};

interface Aug { rot: number; scale: number; tx: number; ty: number; shear: number; gamma: number; contrast: number; bright: number; ramp: number; blur: number; noise: number }
const IDENT: Aug = { rot: 0, scale: 1, tx: 0, ty: 0, shear: 0, gamma: 1, contrast: 1, bright: 0, ramp: 0, blur: 0, noise: 0 };

function render(s: Src, a: Aug, r: () => number): Float32Array {
  const out = new Float32Array(SIZE * SIZE);
  const c = Math.cos(-a.rot), sn = Math.sin(-a.rot);
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) {
      let u = (x + 0.5) / SIZE - 0.5, v = (y + 0.5) / SIZE - 0.5;
      u += a.shear * v;
      const ru = (c * u - sn * v) / a.scale + a.tx, rv = (sn * u + c * v) / a.scale + a.ty;
      let val = sample(s, (0.5 + ru) * s.w, (0.5 + rv) * s.h);
      val = 255 * Math.pow(Math.max(0, val) / 255, a.gamma);
      val = (val - 128) * a.contrast + 128 + a.bright + a.ramp * ((x / SIZE) - 0.5) * 100;
      out[y * SIZE + x] = val;
    }
  let res = out;
  if (a.blur > 0.3) {
    const k: number[] = []; const rad = Math.ceil(a.blur * 3); let sum = 0;
    for (let i = -rad; i <= rad; i++) { const w = Math.exp(-i * i / (2 * a.blur * a.blur)); k.push(w); sum += w; }
    const tmp = new Float32Array(out.length); res = new Float32Array(out.length);
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) { let t = 0; for (let i = -rad; i <= rad; i++) t += out[y * SIZE + Math.min(SIZE - 1, Math.max(0, x + i))] * k[i + rad]; tmp[y * SIZE + x] = t / sum; }
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) { let t = 0; for (let i = -rad; i <= rad; i++) t += tmp[Math.min(SIZE - 1, Math.max(0, y + i)) * SIZE + x] * k[i + rad]; res[y * SIZE + x] = t / sum; }
  }
  if (a.noise > 0) for (let i = 0; i < res.length; i++) res[i] += gauss(r) * a.noise;
  for (let i = 0; i < res.length; i++) res[i] = Math.min(255, Math.max(0, res[i]));
  return res;
}

const U = (r: () => number, lo: number, hi: number) => lo + (hi - lo) * r();
const LEVELS: Record<string, (r: () => number) => Aug> = {
  mild: (r) => ({ rot: U(r, -0.2, 0.2), scale: U(r, 0.9, 1.1), tx: U(r, -0.03, 0.03), ty: U(r, -0.03, 0.03), shear: U(r, -0.04, 0.04), gamma: U(r, 0.85, 1.2), contrast: U(r, 0.85, 1.15), bright: U(r, -20, 20), ramp: U(r, -0.3, 0.3), blur: U(r, 0, 1), noise: U(r, 0, 4) }),
  hard: (r) => ({ rot: U(r, -0.5, 0.5), scale: U(r, 0.78, 1.28), tx: U(r, -0.07, 0.07), ty: U(r, -0.07, 0.07), shear: U(r, -0.1, 0.1), gamma: U(r, 0.6, 1.6), contrast: U(r, 0.6, 1.4), bright: U(r, -45, 45), ramp: U(r, -0.7, 0.7), blur: U(r, 0.5, 2), noise: U(r, 2, 10) }),
};

// Identity groups found by scripts/pairs.ts: X.jpg and X-3.jpg are the same animal (re-framed); muzzle-hero = muzzle.
const grp = (f: string) => f.replace('-hero', '').replace('-3', '').replace('.jpg', '');
const gid = files.map(grp);
const dh = (g: Float32Array) => { const b: number[] = []; const px = (x: number, y: number) => { let t = 0; for (let j = 0; j < 32; j++) for (let i = 0; i < 28; i++) t += g[(y * 32 + j) * SIZE + Math.min(SIZE - 1, x * 28 + i)]; return t; };
  for (let y = 0; y < 8; y++) for (let x = 0; x < 9; x++) b.push(px(x, y)); const bits: number[] = []; for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) bits.push(b[y * 9 + x] > b[y * 9 + x + 1] ? 1 : 0); return bits; };
const ham = (a: number[], b: number[]) => a.reduce((s, v, i) => s + (v !== b[i] ? 1 : 0), 0);
const t0 = Date.now();
const srcs = files.map(load);
const gDh = srcs.map((s) => dh(render(s, IDENT, rng(1))));
const gallery: FeatureSet[] = srcs.map((s) => extractFeatures(render(s, IDENT, rng(1))));
console.log(`identities=${files.length}  keypoints/template avg=${(gallery.reduce((a, f) => a + f.n, 0) / gallery.length).toFixed(0)}  enrol ms/img=${((Date.now() - t0) / files.length).toFixed(0)}`);

const PROBES = Number(process.env.PROBES ?? 6);
for (const [level, make] of Object.entries(LEVELS)) {
  const r = rng(level === 'mild' ? 7 : 99);
  let top1 = 0, total = 0, dhOk = 0, dhFalse = 0, below = 0; const genuine: number[] = [], impostor: number[] = []; const wrong: string[] = [];
  const tm = Date.now();
  srcs.forEach((s, id) => {
    for (let p = 0; p < PROBES; p++) {
      const img = render(s, make(r), r); const probe = extractFeatures(img);
      { const h = dh(img); const d = gDh.map((g) => ham(h, g)); const bi = d.indexOf(Math.min(...d)); if (Math.min(...d) <= 10) { if (gid[bi] === gid[id]) dhOk++; else dhFalse++; } }
      const scores = gallery.map((g) => matchFeatures(probe, g).inliers);
      let bestSame = 0, bestOther = 0;
      scores.forEach((v, j) => { if (gid[j] === gid[id]) bestSame = Math.max(bestSame, v); else { impostor.push(v); bestOther = Math.max(bestOther, v); } });
      genuine.push(bestSame); if (bestSame < 12) below++;
      total++; if (bestSame > bestOther) top1++; else wrong.push(`${files[id]}(g=${bestSame},imp=${bestOther})`);
    }
  });
  const sorted = (a: number[]) => [...a].sort((x, y) => x - y);
  const q = (a: number[], p: number) => sorted(a)[Math.min(a.length - 1, Math.floor(p * a.length))];
  const maxImp = Math.max(...impostor);
  const thr = maxImp + 1;
  const frr = genuine.filter((v) => v < thr).length / genuine.length;
  console.log(`\n[${level}] probes=${total}  rank-1=${(100 * top1 / total).toFixed(1)}%  ms/probe=${((Date.now() - tm) / (total * (1 + files.length / 40))).toFixed(0)}(approx)`);
  console.log(`  genuine inliers: min=${q(genuine, 0)} p5=${q(genuine, .05)} median=${q(genuine, .5)}`);
  console.log(`  impostor inliers: median=${q(impostor, .5)} p99=${q(impostor, .99)} max=${maxImp}   (impostor pairs=${impostor.length})`);
  console.log(`  at threshold>=${thr}: FAR=0 on these pairs, FRR=${(100 * frr).toFixed(1)}%`);
  console.log(`  deployed threshold (12 inliers): FRR=${(100 * below / total).toFixed(1)}%   |   OLD dHash baseline: correct=${(100 * dhOk / total).toFixed(1)}% false-match=${(100 * dhFalse / total).toFixed(1)}%`);
  if (wrong.length) console.log('  misses:', wrong.slice(0, 8).join(' '));
}
