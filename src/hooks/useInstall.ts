import { useEffect, useState } from 'react';

interface BIPEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }
let deferred: BIPEvent | null = null;
const subs = new Set<() => void>();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e as BIPEvent; subs.forEach((s) => s()); });
  window.addEventListener('appinstalled', () => { deferred = null; subs.forEach((s) => s()); });
}

export function useInstall() {
  const [, force] = useState(0);
  useEffect(() => { const s = () => force((x) => x + 1); subs.add(s); return () => { subs.delete(s); }; }, []);
  const standalone = typeof window !== 'undefined' && window.matchMedia?.('(display-mode: standalone)').matches;
  return {
    canInstall: !!deferred,
    installed: standalone,
    install: async () => { if (!deferred) return false; await deferred.prompt(); const c = await deferred.userChoice; deferred = null; return c.outcome === 'accepted'; },
  };
}
