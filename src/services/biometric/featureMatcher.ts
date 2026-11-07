// DOM-free local-feature matcher for muzzle images.
//
// Cattle muzzle prints are a texture of beads and ridges, so the approach is classical local-feature
// matching, the same family as published muzzle-recognition baselines:
//   1. illumination normalisation (local mean/contrast)  -> robust to sun, shade, flash
//   2. DoG blob keypoints across scales                  -> robust to distance / zoom
//   3. dominant orientation + SIFT-style descriptor      -> robust to head tilt / rotation
//   4. mutual nearest neighbour + Lowe ratio test        -> drops ambiguous matches
//   5. geometric verification (similarity transform)     -> only spatially consistent matches count
// The number of geometrically consistent matches ("inliers") is the match score.

export const SIZE = 256; // analysis resolution (square)
export const MAX_KP = 160;
const CELLS = 4;
const BINS = 8;
export const DESC_DIM = CELLS * CELLS * BINS; // 128
const SIGMAS = [1.6, 2.263, 3.2, 4.525, 6.4, 9.05];

export interface FeatureSet {
  n: number;
  /** x, y, sigma, angle per keypoint */
  kp: Float32Array;
  desc: Uint8Array;
}

// ---------- basic image ops ----------

function kernel(sigma: number) {
  const r = Math.max(1, Math.ceil(sigma * 3));
  const k = new Float32Array(2 * r + 1);
  let s = 0;
  for (let i = -r; i <= r; i++) { k[i + r] = Math.exp(-(i * i) / (2 * sigma * sigma)); s += k[i + r]; }
  for (let i = 0; i < k.length; i++) k[i] /= s;
  return { k, r };
}

export function blur(src: Float32Array, w: number, h: number, sigma: number) {
  const { k, r } = kernel(sigma);
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let i = -r; i <= r; i++) {
        const xx = x + i < 0 ? 0 : x + i >= w ? w - 1 : x + i;
        s += src[row + xx] * k[i + r];
      }
      tmp[row + x] = s;
    }
  }
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let i = -r; i <= r; i++) {
        const yy = y + i < 0 ? 0 : y + i >= h ? h - 1 : y + i;
        s += tmp[yy * w + x] * k[i + r];
      }
      out[y * w + x] = s;
    }
  return out;
}

/** Remove slow lighting gradients and equalise local contrast. */
export function normalizeIllumination(g: Float32Array, w: number, h: number) {
  const m = blur(g, w, h, 8);
  const d = new Float32Array(w * h);
  const d2 = new Float32Array(w * h);
  for (let i = 0; i < d.length; i++) { d[i] = g[i] - m[i]; d2[i] = d[i] * d[i]; }
  const v = blur(d2, w, h, 8);
  const out = new Float32Array(w * h);
  for (let i = 0; i < out.length; i++) out[i] = d[i] / (Math.sqrt(v[i]) + 3);
  return out;
}

// ---------- feature extraction ----------

interface Cand { x: number; y: number; li: number; resp: number }

export function extractFeatures(gray: Float32Array, w = SIZE, h = SIZE, maxKp = MAX_KP): FeatureSet {
  const img = normalizeIllumination(gray, w, h);
  const L = SIGMAS.map((s) => blur(img, w, h, s));
  const dog: Float32Array[] = [];
  for (let i = 0; i < L.length - 1; i++) {
    const d = new Float32Array(w * h);
    for (let p = 0; p < d.length; p++) d[p] = L[i + 1][p] - L[i][p];
    dog.push(d);
  }

  // 3D extrema on DoG levels 1..3
  const cands: Cand[] = [];
  const R = 10;
  const edgeLimit = (R + 1) * (R + 1) / R;
  for (let li = 1; li < dog.length - 1; li++) {
    const s = SIGMAS[li];
    const margin = Math.ceil(2 * s + 4);
    const D = dog[li];
    for (let y = margin; y < h - margin; y++)
      for (let x = margin; x < w - margin; x++) {
        const i = y * w + x;
        const v = D[i];
        if (Math.abs(v) < 0.02) continue;
        let isMax = true, isMin = true;
        for (let dl = -1; dl <= 1 && (isMax || isMin); dl++) {
          const N = dog[li + dl];
          for (let dy = -1; dy <= 1; dy++)
            for (let dx = -1; dx <= 1; dx++) {
              if (dl === 0 && dx === 0 && dy === 0) continue;
              const nv = N[i + dy * w + dx];
              if (nv >= v) isMax = false;
              if (nv <= v) isMin = false;
            }
        }
        if (!isMax && !isMin) continue;
        // reject edge-like responses
        const dxx = D[i + 1] + D[i - 1] - 2 * v;
        const dyy = D[i + w] + D[i - w] - 2 * v;
        const dxy = (D[i + w + 1] - D[i + w - 1] - D[i - w + 1] + D[i - w - 1]) / 4;
        const tr = dxx + dyy, det = dxx * dyy - dxy * dxy;
        if (det <= 0 || (tr * tr) / det > edgeLimit) continue;
        cands.push({ x, y, li, resp: Math.abs(v) });
      }
  }

  // strongest first, with minimum spacing so keypoints cover the muzzle
  cands.sort((a, b) => b.resp - a.resp);
  const chosen: Cand[] = [];
  const minDist2 = 25;
  for (const c of cands) {
    if (chosen.length >= maxKp) break;
    let ok = true;
    for (const o of chosen) { const dx = o.x - c.x, dy = o.y - c.y; if (dx * dx + dy * dy < minDist2) { ok = false; break; } }
    if (ok) chosen.push(c);
  }

  // gradients of the smoothed levels we need
  const grads = new Map<number, { mag: Float32Array; ang: Float32Array }>();
  const gradOf = (li: number) => {
    let g = grads.get(li);
    if (g) return g;
    const l = L[li];
    const mag = new Float32Array(w * h), ang = new Float32Array(w * h);
    for (let y = 1; y < h - 1; y++)
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        const gx = l[i + 1] - l[i - 1], gy = l[i + w] - l[i - w];
        mag[i] = Math.hypot(gx, gy);
        ang[i] = Math.atan2(gy, gx);
      }
    g = { mag, ang };
    grads.set(li, g);
    return g;
  };

  const n = chosen.length;
  const kp = new Float32Array(n * 4);
  const desc = new Uint8Array(n * DESC_DIM);
  const TWO_PI = Math.PI * 2;

  chosen.forEach((c, idx) => {
    const sigma = SIGMAS[c.li];
    const { mag, ang } = gradOf(c.li);

    // dominant orientation
    const hist = new Float32Array(36);
    const rad = Math.round(4.5 * sigma);
    const ws = 1.5 * sigma;
    for (let dy = -rad; dy <= rad; dy++)
      for (let dx = -rad; dx <= rad; dx++) {
        const x = c.x + dx, y = c.y + dy;
        if (x < 1 || y < 1 || x >= w - 1 || y >= h - 1) continue;
        const i = y * w + x;
        const wt = Math.exp(-(dx * dx + dy * dy) / (2 * ws * ws));
        let a = ang[i]; if (a < 0) a += TWO_PI;
        hist[Math.min(35, Math.floor((a / TWO_PI) * 36))] += wt * mag[i];
      }
    for (let pass = 0; pass < 2; pass++) {
      const t = hist.slice();
      for (let b = 0; b < 36; b++) hist[b] = (t[(b + 35) % 36] + t[b] + t[(b + 1) % 36]) / 3;
    }
    let pk = 0;
    for (let b = 1; b < 36; b++) if (hist[b] > hist[pk]) pk = b;
    const l = hist[(pk + 35) % 36], m = hist[pk], r = hist[(pk + 1) % 36];
    const off = l - 2 * m + r !== 0 ? (0.5 * (l - r)) / (l - 2 * m + r) : 0;
    const angle = ((pk + 0.5 + off) / 36) * TWO_PI;

    // descriptor
    const cellW = 3 * sigma;
    const half = Math.ceil(cellW * (CELLS + 1) * 0.5 * Math.SQRT2);
    const cos = Math.cos(angle), sin = Math.sin(angle);
    const hv = new Float32Array(DESC_DIM);
    for (let dy = -half; dy <= half; dy++)
      for (let dx = -half; dx <= half; dx++) {
        const xr = (cos * dx + sin * dy) / cellW;
        const yr = (-sin * dx + cos * dy) / cellW;
        const cb = xr + CELLS / 2 - 0.5, rb = yr + CELLS / 2 - 0.5;
        if (cb <= -1 || cb >= CELLS || rb <= -1 || rb >= CELLS) continue;
        const x = c.x + dx, y = c.y + dy;
        if (x < 1 || y < 1 || x >= w - 1 || y >= h - 1) continue;
        const i = y * w + x;
        let a = ang[i] - angle;
        a = ((a % TWO_PI) + TWO_PI) % TWO_PI;
        const ob = (a / TWO_PI) * BINS;
        const wt = Math.exp(-(xr * xr + yr * yr) / (2 * (CELLS / 2) * (CELLS / 2))) * mag[i];
        const c0 = Math.floor(cb), r0 = Math.floor(rb), o0 = Math.floor(ob);
        const fc = cb - c0, fr = rb - r0, fo = ob - o0;
        for (let dr = 0; dr < 2; dr++) {
          const rr = r0 + dr; if (rr < 0 || rr >= CELLS) continue;
          const wr = dr ? fr : 1 - fr;
          for (let dc = 0; dc < 2; dc++) {
            const cc = c0 + dc; if (cc < 0 || cc >= CELLS) continue;
            const wc = dc ? fc : 1 - fc;
            for (let dor = 0; dor < 2; dor++) {
              const oo = (o0 + dor) % BINS;
              hv[(rr * CELLS + cc) * BINS + oo] += wt * wr * wc * (dor ? fo : 1 - fo);
            }
          }
        }
      }
    // normalise, clamp, renormalise (illumination invariance), quantise
    let nrm = 0; for (let k = 0; k < DESC_DIM; k++) nrm += hv[k] * hv[k];
    nrm = Math.sqrt(nrm) + 1e-9;
    let n2 = 0;
    for (let k = 0; k < DESC_DIM; k++) { hv[k] = Math.min(hv[k] / nrm, 0.2); n2 += hv[k] * hv[k]; }
    n2 = Math.sqrt(n2) + 1e-9;
    for (let k = 0; k < DESC_DIM; k++) desc[idx * DESC_DIM + k] = Math.min(255, Math.round((hv[k] / n2) * 512));

    kp[idx * 4] = c.x; kp[idx * 4 + 1] = c.y; kp[idx * 4 + 2] = sigma; kp[idx * 4 + 3] = angle;
  });

  return { n, kp, desc };
}

// ---------- matching ----------

export interface MatchDetail { tentative: number; inliers: number }

const RATIO2 = 0.8 * 0.8;
const INLIER_PX = 7;

export type GeoModel = 'similarity' | 'affine';

export function matchFeatures(A: FeatureSet, B: FeatureSet, model: GeoModel = 'similarity'): MatchDetail {
  if (A.n < 3 || B.n < 3) return { tentative: 0, inliers: 0 };
  const dist = new Float32Array(A.n * B.n);
  const bestA = new Int32Array(A.n).fill(-1), d1A = new Float32Array(A.n).fill(Infinity), d2A = new Float32Array(A.n).fill(Infinity);
  const bestB = new Int32Array(B.n).fill(-1), d1B = new Float32Array(B.n).fill(Infinity);
  for (let i = 0; i < A.n; i++) {
    const ai = i * DESC_DIM;
    for (let j = 0; j < B.n; j++) {
      const bj = j * DESC_DIM;
      let s = 0;
      for (let k = 0; k < DESC_DIM; k++) { const d = A.desc[ai + k] - B.desc[bj + k]; s += d * d; }
      dist[i * B.n + j] = s;
      if (s < d1A[i]) { d2A[i] = d1A[i]; d1A[i] = s; bestA[i] = j; } else if (s < d2A[i]) d2A[i] = s;
      if (s < d1B[j]) { d1B[j] = s; bestB[j] = i; }
    }
  }
  const pairs: number[] = [];
  for (let i = 0; i < A.n; i++) {
    const j = bestA[i];
    if (j < 0 || bestB[j] !== i) continue; // mutual nearest neighbours only
    if (d1A[i] < RATIO2 * d2A[i]) pairs.push(i, j);
  }
  const M = pairs.length / 2;
  if (M < 3) return { tentative: M, inliers: 0 };

  const ax = new Float32Array(M), ay = new Float32Array(M), bx = new Float32Array(M), by = new Float32Array(M);
  if (model === 'affine') {
    for (let m = 0; m < M; m++) { const i = pairs[2 * m], j = pairs[2 * m + 1]; ax[m] = A.kp[i * 4]; ay[m] = A.kp[i * 4 + 1]; bx[m] = B.kp[j * 4]; by[m] = B.kp[j * 4 + 1]; }
    return { tentative: M, inliers: affineRansac(ax, ay, bx, by, M) };
  }
  const hyp: { s: number; c: number; sn: number; tx: number; ty: number }[] = [];
  for (let m = 0; m < M; m++) {
    const i = pairs[2 * m], j = pairs[2 * m + 1];
    ax[m] = A.kp[i * 4]; ay[m] = A.kp[i * 4 + 1]; bx[m] = B.kp[j * 4]; by[m] = B.kp[j * 4 + 1];
    const s = B.kp[j * 4 + 2] / A.kp[i * 4 + 2];
    const th = B.kp[j * 4 + 3] - A.kp[i * 4 + 3];
    const c = Math.cos(th) * s, sn = Math.sin(th) * s;
    hyp.push({ s, c, sn, tx: bx[m] - (c * ax[m] - sn * ay[m]), ty: by[m] - (sn * ax[m] + c * ay[m]) });
  }
  const count = (t: { c: number; sn: number; tx: number; ty: number }, thr: number, mask?: Uint8Array) => {
    let n = 0;
    for (let m = 0; m < M; m++) {
      const px = t.c * ax[m] - t.sn * ay[m] + t.tx - bx[m];
      const py = t.sn * ax[m] + t.c * ay[m] + t.ty - by[m];
      if (px * px + py * py <= thr * thr) { n++; if (mask) mask[m] = 1; }
    }
    return n;
  };
  let best = 0, bestIdx = -1;
  for (let m = 0; m < M; m++) {
    if (hyp[m].s < 0.5 || hyp[m].s > 2) continue;
    const n = count(hyp[m], INLIER_PX);
    if (n > best) { best = n; bestIdx = m; }
  }
  if (bestIdx < 0) return { tentative: M, inliers: 0 };

  // least-squares similarity refit on the inliers (complex-number form), then recount
  let t = hyp[bestIdx];
  for (let iter = 0; iter < 2; iter++) {
    const mask = new Uint8Array(M);
    count(t, INLIER_PX, mask);
    let n = 0, sax = 0, say = 0, sbx = 0, sby = 0;
    for (let m = 0; m < M; m++) if (mask[m]) { n++; sax += ax[m]; say += ay[m]; sbx += bx[m]; sby += by[m]; }
    if (n < 3) break;
    const max = sax / n, may = say / n, mbx = sbx / n, mby = sby / n;
    let num_r = 0, num_i = 0, den = 0;
    for (let m = 0; m < M; m++) if (mask[m]) {
      const px = ax[m] - max, py = ay[m] - may, qx = bx[m] - mbx, qy = by[m] - mby;
      num_r += px * qx + py * qy; num_i += px * qy - py * qx; den += px * px + py * py;
    }
    if (den < 1e-6) break;
    const c = num_r / den, sn = num_i / den;
    t = { ...t, c, sn, tx: mbx - (c * max - sn * may), ty: mby - (sn * max + c * may) };
  }
  const inliers = count(t, INLIER_PX);
  return { tentative: M, inliers: Math.max(inliers, best) };
}

// ---------- compact (de)serialisation ----------

const PREFIX = 'MZF1:';

export function serialize(f: FeatureSet): string {
  const per = 6 + DESC_DIM;
  const buf = new Uint8Array(f.n * per);
  for (let i = 0; i < f.n; i++) {
    const o = i * per;
    const x = Math.round(f.kp[i * 4] * 128), y = Math.round(f.kp[i * 4 + 1] * 128);
    buf[o] = x >> 8; buf[o + 1] = x & 255; buf[o + 2] = y >> 8; buf[o + 3] = y & 255;
    buf[o + 4] = Math.round(f.kp[i * 4 + 2] * 16);
    buf[o + 5] = Math.round((f.kp[i * 4 + 3] / (Math.PI * 2)) * 256) & 255;
    buf.set(f.desc.subarray(i * DESC_DIM, (i + 1) * DESC_DIM), o + 6);
  }
  let bin = '';
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return PREFIX + btoa(bin);
}

export function deserialize(full: string): FeatureSet | null {
  const s = (full || '').split('#')[0]; // a template may carry an AI embedding after '#'
  if (!s || !s.startsWith(PREFIX)) return null;
  try {
    const bin = atob(s.slice(PREFIX.length));
    const per = 6 + DESC_DIM;
    if (bin.length === 0 || bin.length % per !== 0) return null;
    const n = bin.length / per;
    const kp = new Float32Array(n * 4);
    const desc = new Uint8Array(n * DESC_DIM);
    for (let i = 0; i < n; i++) {
      const o = i * per;
      const b = (k: number) => bin.charCodeAt(o + k);
      kp[i * 4] = ((b(0) << 8) | b(1)) / 128;
      kp[i * 4 + 1] = ((b(2) << 8) | b(3)) / 128;
      kp[i * 4 + 2] = b(4) / 16;
      kp[i * 4 + 3] = (b(5) / 256) * Math.PI * 2;
      for (let k = 0; k < DESC_DIM; k++) desc[i * DESC_DIM + k] = b(6 + k);
    }
    return { n, kp, desc };
  } catch { return null; }
}


// ---------- affine verification (tolerates head turns / camera tilt) ----------

function det3(a: number[], b: number[], c: number[]) {
  return a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0]);
}

/** Least-squares affine from a set of correspondences (normal equations). Returns [a,b,tx,c,d,ty]. */
function fitAffine(ax: Float32Array, ay: Float32Array, bx: Float32Array, by: Float32Array, idx: number[]) {
  let sxx = 0, sxy = 0, syy = 0, sx = 0, sy = 0, n = idx.length;
  let bxx = 0, bxy = 0, bx1 = 0, byx = 0, byy = 0, by1 = 0;
  for (const m of idx) {
    const x = ax[m], y = ay[m];
    sxx += x * x; sxy += x * y; syy += y * y; sx += x; sy += y;
    bxx += x * bx[m]; bxy += y * bx[m]; bx1 += bx[m];
    byx += x * by[m]; byy += y * by[m]; by1 += by[m];
  }
  const M = [[sxx, sxy, sx], [sxy, syy, sy], [sx, sy, n]];
  const D = det3(M[0], M[1], M[2]);
  if (Math.abs(D) < 1e-6) return null;
  const solve = (r: number[]) => {
    const col = (k: number) => M.map((row, i) => row.map((v, j) => (j === k ? r[i] : v)));
    return [0, 1, 2].map((k) => { const c = col(k); return det3(c[0], c[1], c[2]) / D; });
  };
  const [a, b, tx] = solve([bxx, bxy, bx1]);
  const [c, d, ty] = solve([byx, byy, by1]);
  return [a, b, tx, c, d, ty];
}

function plausible(t: number[]) {
  const det = t[0] * t[4] - t[1] * t[3];
  const sc = Math.sqrt(Math.abs(det));
  if (det <= 0 || sc < 0.4 || sc > 2.5) return false;
  const f = t[0] * t[0] + t[1] * t[1] + t[3] * t[3] + t[4] * t[4];
  return f / Math.abs(det) < 6; // limits extreme shear / squash
}

function affineRansac(ax: Float32Array, ay: Float32Array, bx: Float32Array, by: Float32Array, M: number) {
  if (M < 4) return 0;
  const count = (t: number[], mask?: number[]) => {
    let n = 0;
    for (let m = 0; m < M; m++) {
      const px = t[0] * ax[m] + t[1] * ay[m] + t[2] - bx[m];
      const py = t[3] * ax[m] + t[4] * ay[m] + t[5] - by[m];
      if (px * px + py * py <= INLIER_PX * INLIER_PX) { n++; mask?.push(m); }
    }
    return n;
  };
  let seed = 12345;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  let best = 0, bestT: number[] | null = null;
  for (let it = 0; it < 400; it++) {
    const i0 = Math.floor(rnd() * M); let i1 = Math.floor(rnd() * M); let i2 = Math.floor(rnd() * M);
    if (i1 === i0 || i2 === i0 || i1 === i2) continue;
    const t = fitAffine(ax, ay, bx, by, [i0, i1, i2]);
    if (!t || !plausible(t)) continue;
    const n = count(t);
    if (n > best) { best = n; bestT = t; }
  }
  if (!bestT) return 0;
  for (let k = 0; k < 3; k++) {
    const mask: number[] = []; count(bestT, mask);
    if (mask.length < 4) break;
    const t = fitAffine(ax, ay, bx, by, mask);
    if (!t || !plausible(t)) break;
    bestT = t;
  }
  return Math.max(best, count(bestT));
}

// ---------- simulated viewpoints (ASIFT-style) ----------

export interface View { t: number; phi: number }
/** Tilt factor t along direction phi (degrees) mimics the muzzle being viewed from an oblique angle. */
export const VIEWS: View[] = [
  { t: 1, phi: 0 },
  { t: 1.6, phi: 0 }, { t: 1.6, phi: 45 }, { t: 1.6, phi: 90 }, { t: 1.6, phi: 135 },
  { t: 2.4, phi: 0 }, { t: 2.4, phi: 90 },
];

function tiltImage(g: Float32Array, w: number, h: number, t: number, phiDeg: number, fill: number) {
  const phi = (phiDeg * Math.PI) / 180, c = Math.cos(phi), s = Math.sin(phi);
  const cx = (w - 1) / 2, cy = (h - 1) / 2;
  const ns = Math.max(1, Math.ceil(t));
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let k = 0; k < ns; k++) {
        const off = (k + 0.5) / ns - 0.5;
        const ox = x - cx + off * c, oy = y - cy + off * s;
        const p = ox * c + oy * s;
        const sx = ox + (t - 1) * p * c + cx, sy = oy + (t - 1) * p * s + cy;
        if (sx < 0 || sy < 0 || sx > w - 1.001 || sy > h - 1.001) { acc += fill; continue; }
        const x0 = Math.floor(sx), y0 = Math.floor(sy), fx = sx - x0, fy = sy - y0, i = y0 * w + x0;
        acc += (g[i] * (1 - fx) + g[i + 1] * fx) * (1 - fy) + (g[i + w] * (1 - fx) + g[i + w + 1] * fx) * fy;
      }
      out[y * w + x] = acc / ns;
    }
  return out;
}

/** Extract features from several simulated viewpoints and express them all in the original image frame. */
export function extractMultiView(gray: Float32Array, w = SIZE, h = SIZE, views: View[] = VIEWS, perView = 110): FeatureSet {
  let mean = 0; for (let i = 0; i < gray.length; i++) mean += gray[i]; mean /= gray.length;
  const kps: number[] = [], descs: Uint8Array[] = [];
  const cx = (w - 1) / 2, cy = (h - 1) / 2;
  for (const v of views) {
    const img = v.t === 1 ? gray : tiltImage(gray, w, h, v.t, v.phi, mean);
    const f = extractFeatures(img, w, h, perView);
    const phi = (v.phi * Math.PI) / 180, c = Math.cos(phi), s = Math.sin(phi);
    for (let i = 0; i < f.n; i++) {
      let x = f.kp[i * 4], y = f.kp[i * 4 + 1], sg = f.kp[i * 4 + 2], an = f.kp[i * 4 + 3];
      if (v.t !== 1) {
        const dx = x - cx, dy = y - cy, p = dx * c + dy * s;
        x = x + (v.t - 1) * p * c; y = y + (v.t - 1) * p * s;
        const q = Math.cos(an) * c + Math.sin(an) * s;
        an = Math.atan2(Math.sin(an) + (v.t - 1) * q * s, Math.cos(an) + (v.t - 1) * q * c);
        sg *= Math.sqrt(v.t);
        if (x < 6 || y < 6 || x > w - 7 || y > h - 7) continue; // synthetic border artefacts
      }
      kps.push(x, y, sg, an);
      descs.push(f.desc.subarray(i * DESC_DIM, (i + 1) * DESC_DIM));
    }
  }
  const n = kps.length / 4;
  const desc = new Uint8Array(n * DESC_DIM);
  descs.forEach((d, i) => desc.set(d, i * DESC_DIM));
  return { n, kp: Float32Array.from(kps), desc };
}
