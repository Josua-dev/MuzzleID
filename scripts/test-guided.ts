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
const front = srcs.map((x) => extractFeatures(render(x, 0, 0, 0, 1, 0)));
let pass = 0, tot = 0, falsePass = 0, falseTot = 0; const gen: number[] = [], imp: number[] = [];
srcs.forEach((x, id) => {
  const side = extractMultiView(render(x, (id % 2 ? -1 : 1) * 25, U(-8, 8), U(-.2, .2), U(.85, 1.2), 2));
  front.forEach((f, j) => { const n = matchFeatures(side, f, 'affine').inliers;
    if (gid[j] === gid[id]) { tot++; gen.push(n); if (n >= 12) pass++; } else { falseTot++; imp.push(n); if (n >= 12) falsePass++; } });
});
gen.sort((a, b) => a - b); imp.sort((a, b) => a - b);
console.log(`side(25deg)-vs-front SAME animal: accepted ${pass}/${tot}  min=${gen[0]} median=${gen[gen.length >> 1]}`);
console.log(`side(25deg)-vs-front DIFFERENT animal: wrongly accepted ${falsePass}/${falseTot}  max=${imp[imp.length - 1]}`);
