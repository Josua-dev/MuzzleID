// Minimal hash router (works offline, on static hosting, and from a single file).
import { useEffect, useState, type ReactNode, type MouseEvent } from 'react';

const parse = () => {
  const raw = window.location.hash.replace(/^#/, '') || '/';
  const [path, qs = ''] = raw.split('?');
  return { path: path || '/', query: new URLSearchParams(qs) };
};

export function useRoute() {
  const [r, setR] = useState(parse);
  useEffect(() => {
    const h = () => { setR(parse()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', h);
    return () => window.removeEventListener('hashchange', h);
  }, []);
  return r;
}

export const navigate = (to: string, replace = false) => {
  const url = `#${to}`;
  if (replace) { history.replaceState(null, '', url); window.dispatchEvent(new HashChangeEvent('hashchange')); }
  else window.location.hash = to;
};

export const back = (fallback = '/app') => {
  if (window.history.length > 1) window.history.back();
  else navigate(fallback);
};

/** Match "/app/animal/:id" against a path. */
export function match(pattern: string, path: string): Record<string, string> | null {
  const p = pattern.split('/').filter(Boolean);
  const s = path.split('/').filter(Boolean);
  if (p.length !== s.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < p.length; i++) {
    if (p[i].startsWith(':')) params[p[i].slice(1)] = decodeURIComponent(s[i]);
    else if (p[i] !== s[i]) return null;
  }
  return params;
}

export function Link({ to, className, children, onClick }: { to: string; className?: string; children: ReactNode; onClick?: () => void }) {
  return (
    <a href={`#${to}`} className={className} onClick={(e: MouseEvent<HTMLAnchorElement>) => { onClick?.(); if (e.metaKey || e.ctrlKey) return; }}>
      {children}
    </a>
  );
}
