// Resolves static asset paths. The standalone single-file demo injects window.__MZ_ASSETS (inlined images);
// normal builds serve the files from /public.
export const asset = (src?: string): string => {
  if (!src) return '';
  const map = (globalThis as unknown as { __MZ_ASSETS?: Record<string, string> }).__MZ_ASSETS;
  return (map && map[src]) || src;
};
