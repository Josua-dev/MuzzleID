// Small, dependency-free image helpers used by the simulator's quality checks and perceptual hash.

export function loadGray(src: string, w: number, h: number): Promise<Float32Array> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d', { willReadFrequently: true } as CanvasRenderingContext2DSettings);
      if (!ctx) return reject(new Error('Canvas unavailable'));
      ctx.drawImage(img, 0, 0, w, h);
      const d = ctx.getImageData(0, 0, w, h).data;
      const out = new Float32Array(w * h);
      for (let i = 0; i < w * h; i++) out[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
      resolve(out);
    };
    img.onerror = () => reject(new Error('Could not load image'));
    img.src = src;
  });
}

export const mean = (a: Float32Array) => a.reduce((s, v) => s + v, 0) / a.length;

export const std = (a: Float32Array) => {
  const m = mean(a);
  return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / a.length);
};

/** Variance of the Laplacian — a standard sharpness/blur measure. */
export function laplacianVariance(g: Float32Array, w: number, h: number) {
  const vals: number[] = [];
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      vals.push(4 * g[i] - g[i - 1] - g[i + 1] - g[i - w] - g[i + w]);
    }
  const m = vals.reduce((s, v) => s + v, 0) / vals.length;
  return vals.reduce((s, v) => s + (v - m) ** 2, 0) / vals.length;
}

/** 64-bit difference hash (dHash) as 16 hex chars. */
export async function dHash(src: string) {
  const g = await loadGray(src, 9, 8);
  let bits = '';
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) bits += g[y * 9 + x] > g[y * 9 + x + 1] ? '1' : '0';
  let hex = '';
  for (let i = 0; i < 64; i += 4) hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  return hex;
}

export function hamming(a: string, b: string) {
  if (a.length !== b.length) return 64;
  let d = 0;
  for (let i = 0; i < a.length; i++) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (x) { d += x & 1; x >>= 1; }
  }
  return d;
}
