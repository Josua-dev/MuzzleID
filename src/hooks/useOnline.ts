import { useEffect, useState } from 'react';
import { useUI, uiStore } from '../services/store';

/** Effective connectivity = browser connectivity AND not in "simulate offline" demo mode. */
export function useOnline() {
  const [browserOnline, setBrowserOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const ui = useUI();
  useEffect(() => {
    const on = () => setBrowserOnline(true);
    const off = () => setBrowserOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  return browserOnline && !ui.simulateOffline;
}

export const isOnlineNow = () => navigator.onLine && !uiStore.get().simulateOffline;
