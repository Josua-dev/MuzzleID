export const cn = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

export const uid = (prefix = 'id') =>
  `${prefix}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;

export const nowIso = () => new Date().toISOString();

export const daysAgo = (d: number, hour = 9) => {
  const t = new Date();
  t.setDate(t.getDate() - d);
  t.setHours(hour, (d * 7) % 60, 0, 0);
  return t.toISOString();
};

export const fmtDate = (iso?: string) => {
  if (!iso) return '—';
  if (/^\d{4}$/.test(iso)) return iso;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

export const fmtDateTime = (iso?: string) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}, ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
};

export const timeAgo = (iso: string) => {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d} d ago`;
  return fmtDate(iso);
};

export const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
};

export const firstName = (n: string) => n.split(' ')[0];

export const birthYear = (b: string) => (b ? b.slice(0, 4) : '—');

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function sha256(text: string): Promise<string> {
  if (globalThis.crypto?.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Fallback for non-secure contexts (demo only)
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (Math.imul(31, h) + text.charCodeAt(i)) | 0;
  return `fallback${h}`;
}

/** Mask a name for privacy-limited views: "Petrus Haufiku" -> "Petrus H." */
export const maskName = (n: string) => {
  const p = n.trim().split(/\s+/);
  return p.length > 1 ? `${p[0]} ${p[p.length - 1][0]}.` : p[0];
};

/** Mask a phone: +264 81 555 0101 -> +264 81 ••• ••01 */
export const maskPhone = (p: string) => {
  const digits = p.replace(/\D/g, '');
  return digits.length < 6 ? '•••' : `+${digits.slice(0, 3)} ${digits.slice(3, 5)} ••• ••${digits.slice(-2)}`;
};

/** Resize an image (data URL / blob URL) to keep on-device storage small. */
export function downscaleImage(src: string, max = 560, quality = 0.78): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d');
      if (!ctx) return reject(new Error('Canvas unavailable'));
      ctx.drawImage(img, 0, 0, w, h);
      resolve(c.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => reject(new Error('Could not read image'));
    img.src = src;
  });
}

export const readFileAsDataUrl = (f: File) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(r.error);
    r.readAsDataURL(f);
  });

/** Deterministic PRNG for seeded visuals and simulated values. */
export function seeded(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

export const REGIONS = ['Khomas', 'Omaheke', 'Otjozondjupa', 'Kunene', 'Erongo', 'Hardap', 'Kavango East', 'Kavango West', 'Karas', 'Ohangwena', 'Omusati', 'Oshana', 'Oshikoto', 'Zambezi'];
export const BREEDS = ['Brahman', 'Nguni', 'Afrikaner', 'Bonsmara', 'Simmentaler', 'Drakensberger', 'Simbra', 'Sanga', 'Beefmaster', 'Hereford', 'Crossbreed'];
export const COLOURS = ['Grey-white', 'Red', 'Dark red', 'Brown', 'Black', 'Speckled brown/white', 'Red with white face', 'Fawn', 'Other'];
