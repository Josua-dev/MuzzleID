// On-device data store (offline-first). Persists to localStorage so records stay available without
// connectivity. When Supabase is configured, changes are pushed through the sync queue (see sync.ts).
import { useSyncExternalStore } from 'react';
import type { DB } from '../types/models';
import { buildDemoDB, DB_VERSION } from '../data/demoData';

const DB_KEY = 'muzzleid.db';
const UI_KEY = 'muzzleid.ui';

type Listener = () => void;

function createStore<T>(initial: T, persistKey?: string) {
  let state = initial;
  const listeners = new Set<Listener>();
  return {
    get: () => state,
    set(next: T) {
      state = next;
      if (persistKey) {
        try {
          localStorage.setItem(persistKey, JSON.stringify(next));
        } catch (e) {
          console.warn('[MuzzleID] Could not persist to device storage', e);
          window.dispatchEvent(new CustomEvent('muzzleid:storage-full'));
        }
      }
      listeners.forEach((l) => l());
    },
    subscribe(l: Listener) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
}

function loadDB(): DB {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DB;
      if (parsed.version === DB_VERSION) return parsed;
    }
  } catch {
    /* fall through to demo data */
  }
  const fresh = buildDemoDB();
  try { localStorage.setItem(DB_KEY, JSON.stringify(fresh)); } catch { /* ignore */ }
  return fresh;
}

export interface UIState {
  sessionUserId: string | null;
  simulateOffline: boolean;
  syncPhase: 'idle' | 'syncing' | 'complete';
  lastSyncAt?: string;
  installDismissed?: boolean;
}

function loadUI(): UIState {
  try {
    const raw = localStorage.getItem(UI_KEY);
    if (raw) return { ...JSON.parse(raw), syncPhase: 'idle' } as UIState;
  } catch { /* ignore */ }
  return { sessionUserId: null, simulateOffline: false, syncPhase: 'idle' };
}

export const dbStore = createStore<DB>(loadDB(), DB_KEY);
export const uiStore = createStore<UIState>(loadUI(), UI_KEY);

/** Apply a mutation to a shallow copy of the DB (all top-level arrays are copied). */
export function mutate(fn: (d: DB) => void) {
  const s = dbStore.get();
  const d: DB = {
    ...s,
    users: [...s.users], farmerProfiles: [...s.farmerProfiles], animals: [...s.animals], biometrics: [...s.biometrics],
    ownership: [...s.ownership], health: [...s.health], vaccinations: [...s.vaccinations], movements: [...s.movements],
    theftReports: [...s.theftReports], scans: [...s.scans], transfers: [...s.transfers], documents: [...s.documents],
    audit: [...s.audit], notifications: [...s.notifications], syncQueue: [...s.syncQueue],
  };
  fn(d);
  dbStore.set(d);
  return d;
}

export const setUI = (patch: Partial<UIState>) => uiStore.set({ ...uiStore.get(), ...patch });

export function resetDemoData() {
  dbStore.set(buildDemoDB());
}

export function useDB<T>(selector: (d: DB) => T): T {
  const d = useSyncExternalStore(dbStore.subscribe, dbStore.get);
  return selector(d);
}

export function useUI(): UIState {
  return useSyncExternalStore(uiStore.subscribe, uiStore.get);
}
