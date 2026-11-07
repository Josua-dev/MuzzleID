// AI embedding layer: a vision transformer turns each muzzle photo into a compact "fingerprint" vector.
// Same animal -> vectors point the same way (high cosine similarity). The model runs fully in the browser
// (transformers.js + ONNX/WASM), is downloaded on first use, and is loaded lazily so the app still works
// (with the classical matcher only) if the download fails or the device is offline.
//
// The default is a general pretrained model (DINOv2-small). It is NOT trained on cattle muzzles.
// To use a muzzle-specific model, train one with training/train_embedder.py and set VITE_EMBED_MODEL.

export const EMBED_MODEL: string = ((import.meta as { env?: Record<string, string> }).env?.VITE_EMBED_MODEL) || 'Xenova/dinov2-small';
const PREFIX = 'MZE1:';

export type AiStatus = 'idle' | 'loading' | 'ready' | 'unavailable';
let status: AiStatus = 'idle';
export const aiStatus = () => status;

// ---------- pure helpers (unit-testable, no DOM) ----------

export function l2(v: Float32Array): Float32Array {
  let n = 0; for (let i = 0; i < v.length; i++) n += v[i] * v[i];
  n = Math.sqrt(n) || 1;
  const o = new Float32Array(v.length); for (let i = 0; i < v.length; i++) o[i] = v[i] / n;
  return o;
}

export function cosine(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s; // inputs are unit length
}

/** int8-quantise a unit vector and base64 it (768 dims -> ~1 KB). */
export function encodeEmbedding(v: Float32Array): string {
  const u = l2(v);
  const bytes = new Uint8Array(u.length);
  for (let i = 0; i < u.length; i++) bytes[i] = Math.max(-127, Math.min(127, Math.round(u[i] * 127 * 4))) & 255; // x4 headroom: components are small
  let bin = ''; for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return PREFIX + btoa(bin);
}

export function decodeEmbedding(s: string | null | undefined): Float32Array | null {
  if (!s || !s.startsWith(PREFIX)) return null;
  try {
    const bin = atob(s.slice(PREFIX.length));
    const v = new Float32Array(bin.length);
    for (let i = 0; i < bin.length; i++) { const b = bin.charCodeAt(i); v[i] = (b > 127 ? b - 256 : b) / (127 * 4); }
    return l2(v);
  } catch { return null; }
}

export interface EmbEntry { animalId: string; emb: Float32Array | null }

/**
 * Pick which animals deserve the (expensive) geometric check. Animals without an embedding are always
 * kept. With a small gallery everything is verified, so the AI can never hide the true animal there.
 */
export function shortlist(probe: Float32Array | null, entries: EmbEntry[], k: number): { keep: Set<string>; sims: Map<string, number> } {
  const sims = new Map<string, number>();
  const ids = new Set(entries.map((e) => e.animalId));
  if (!probe || ids.size <= k) return { keep: ids, sims: probe ? scoreAll(probe, entries) : sims };
  const all = scoreAll(probe, entries);
  const keep = new Set<string>();
  for (const e of entries) if (!e.emb) keep.add(e.animalId);
  [...all.entries()].sort((a, b) => b[1] - a[1]).slice(0, k).forEach(([id]) => keep.add(id));
  return { keep, sims: all };
}

function scoreAll(probe: Float32Array, entries: EmbEntry[]) {
  const m = new Map<string, number>();
  for (const e of entries) if (e.emb) m.set(e.animalId, Math.max(m.get(e.animalId) ?? -1, cosine(probe, e.emb)));
  return m;
}

// ---------- model loading + inference (browser) ----------

type Extractor = (img: unknown, opts?: Record<string, unknown>) => Promise<{ data: Float32Array | number[]; dims: number[] }>;
let extractor: Promise<{ run: Extractor; load: (u: string) => Promise<unknown> } | null> | null = null;

function loadModel() {
  if (extractor) return extractor;
  status = 'loading';
  extractor = (async () => {
    try {
      const tf = await import('@huggingface/transformers');
      const pipe = (await tf.pipeline('image-feature-extraction', EMBED_MODEL, { dtype: 'q8' })) as unknown as Extractor;
      status = 'ready';
      return { run: pipe, load: (u: string) => tf.RawImage.fromURL(u) };
    } catch (e) {
      console.warn('[OwaMuzzle] AI model unavailable, using classical matcher only:', e);
      status = 'unavailable';
      return null;
    }
  })();
  return extractor;
}

/** Start downloading the model early (e.g. when the Scan or Register screen opens). */
export const warmUpAi = () => { void loadModel(); };

/** Embed one image. Resolves null (never throws) if the model is unavailable or too slow. */
export async function embedImage(src: string, timeoutMs = 30000): Promise<Float32Array | null> {
  const work = (async () => {
    const m = await loadModel();
    if (!m) return null;
    const img = await m.load(src);
    const out = await m.run(img);
    const d = out.dims[out.dims.length - 1];
    const data = Float32Array.from(out.data as ArrayLike<number>);
    const tokens = Math.floor(data.length / d);
    if (tokens < 1) return null;
    const cls = l2(data.subarray(0, d));
    const mean = new Float32Array(d);
    const patches = Math.max(1, tokens - 1);
    for (let t = 1; t < tokens; t++) for (let i = 0; i < d; i++) mean[i] += data[t * d + i] / patches;
    const both = new Float32Array(2 * d);
    both.set(cls, 0); both.set(l2(mean), d);
    return l2(both);
  })().catch(() => null);
  return Promise.race([work, new Promise<null>((r) => setTimeout(() => r(null), timeoutMs))]);
}
