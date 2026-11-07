// Viewpoint benchmark: probes simulate the camera moving around the muzzle (yaw/pitch homography)
// plus mild lighting change. PLANAR simulation only: real muzzles are curved, so real angle loss is larger.
import fs from 'node:fs'; import path from 'node:path'; import jpeg from 'jpeg-js';
import { extractFeatures, extractMultiView, matchFeatures, SIZE } from '../src/services/biometric/featureMatcher';

const dir = path.resolve('public/demo');
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.jpg') && f !== 'hero.jpg').sort();
const gid = files.map((f) => f.replace('-hero', '').replace('-3', '').replace('.jpg', ''));
let seed = 4242; const r = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const U = (a: number, b: number) => a + (b - a) * r();
const load = (f: string) => { const { width: w, height: h, data } = jpeg.decode(fs.readFileSync(path.join(dir, f)), { useTArray: true }); const g = new Float32Array(w * h); for (let i = 0; i < w * h; i++) g[i] = .299 * data[i * 4] + .587 * data[i * 4 + 1] + .114 * data[i * 4 + 2]; return { w, h, g }; };
const samp = (s: any, x: number, y: number) => { x = Math.min(s.w - 1.001, Math.max(0, x)); y = Math.min(s.h - 1.001, Math.max(0, y)); const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0, i = y0 * s.w + x0; return (s.g[i] * (1 - fx) + s.g[i + 1] * fx) * (1 - fy) + (s.g[i + s.w] * (1 - fx) + s.g[i + s.w + 1] * fx) * fy; };

function render(s: any, yawDeg: number, pitchDeg: number, roll: number, gamma: number, noise: number) {
  const out = new Float32Array(SIZE * SIZE), F = 1.2, yw = yawDeg * Math.PI / 180, pt = pitchDeg * Math.PI / 180;
  const cy = Math.cos(yw), sy = Math.sin(yw), cp = Math.cos(pt), sp = Math.sin(pt), cr = Math.cos(roll), sr = Math.sin(roll);
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    let u = (x + .5) / SIZE - .5, v = (y + .5) / SIZE - .5;
    [u, v] = [cr * u - sr * v, sr * u + cr * v];
    let X = u, Y = v, Z = F;
    [X, Z] = [cy * X + sy * Z, -sy * X + cy * Z];
    [Y, Z] = [cp * Y - sp * Z, sp * Y + cp * Z];
    const pu = F * X / Z, pv = F * Y / Z;
    let val = samp(s, (0.5 + pu) * s.w, (0.5 + pv) * s.h);
    val = 255 * Math.pow(Math.max(0, val) / 255, gamma) + (r() - .5) * 2 * noise;
    out[y * SIZE + x] = Math.min(255, Math.max(0, val));
  }
  return out;
}
const srcs = files.map(load);
const gal = srcs.map((s) => extractFeatures(render(s, 0, 0, 0, 1, 0)));
const PROBES = Number(process.env.PROBES ?? 2);
const levels = (process.env.LEVELS ?? '15,30,45').split(',').map(Number);
const THR = 12;
for (const L of levels) {
  const modes = { 'A single-view+similarity (current)': [0, 0, 0, 0], 'B multi-view+similarity': [0, 0, 0, 0], 'C multi-view+affine (new)': [0, 0, 0, 0] } as Record<string, number[]>;
  const imp: Record<string, number> = {}; const gen: Record<string, number[]> = {}; for (const k in modes) { imp[k] = 0; gen[k] = []; }
  let total = 0; const t0 = Date.now();
  srcs.forEach((s, id) => { for (let p = 0; p < PROBES; p++) {
    const img = render(s, (r() < .5 ? -1 : 1) * U(L * .8, L), U(-L * .4, L * .4), U(-.3, .3), U(.8, 1.3), U(0, 4));
    const single = extractFeatures(img), multi = extractMultiView(img);
    total++;
    const run = (k: string, probe: any, model: 'similarity' | 'affine') => {
      let same = 0, other = 0; gal.forEach((g, j) => { const v = matchFeatures(probe, g, model).inliers; if (gid[j] === gid[id]) same = Math.max(same, v); else other = Math.max(other, v); });
      imp[k] = Math.max(imp[k], other); gen[k].push(same);
      if (same >= THR && same > other * 1.5) modes[k][0]++;           // correct accept
      if (other >= THR && other >= same) modes[k][1]++;                // false accept (wrong animal)
    };
    run('A single-view+similarity (current)', single, 'similarity');
    run('B multi-view+similarity', multi, 'similarity');
    run('C multi-view+affine (new)', multi, 'affine');
  } });
  console.log(`\n=== viewpoint change ~${L}° yaw (probes=${total}, ${((Date.now() - t0) / 1000).toFixed(0)}s) ===`);
  for (const k in modes) { const g = gen[k].sort((a, b) => a - b); console.log(`${k.padEnd(38)} correct=${(100 * modes[k][0] / total).toFixed(0)}%  false-accept=${(100 * modes[k][1] / total).toFixed(0)}%  genuine median=${g[Math.floor(g.length / 2)]} min=${g[0]}  worst impostor=${imp[k]}`); }
}
