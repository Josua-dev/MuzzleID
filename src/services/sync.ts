// Offline sync engine. Records captured without connectivity are stored on the device with
// status PENDING. When connectivity returns, the queue is processed in order:
//  1) pending registrations get biometric enrolment + duplicate check (server-side step, simulated)
//  2) a permanent MuzzleID is assigned
//  3) rows are pushed to Supabase when configured
import type { DB, OfflineSyncQueueItem } from '../types/models';
import { dbStore, mutate, setUI, uiStore } from './store';
import { biometrics } from './biometric';
import { formatMuzzleId, type EntityRef } from './actions';
import { getSupabase, pushRow, TABLES } from './supabase';
import { nowIso, sleep, uid } from '../lib/utils';

let running = false;

export const pendingCount = (d: DB) => d.syncQueue.filter((q) => q.status === 'PENDING' || q.status === 'FAILED').length;

async function enrolPending(item: OfflineSyncQueueItem) {
  const d = dbStore.get();
  const animal = d.animals.find((a) => a.id === item.entity_id);
  const bios = d.biometrics.filter((b) => b.animal_id === item.entity_id);
  const bio = bios[0];
  if (!animal || !bio || !animal.muzzle_id.startsWith('PENDING')) return;
  const engine = biometrics();
  const templates = new Map<string, Awaited<ReturnType<typeof engine.extractTemplate>>>();
  for (const b of bios) templates.set(b.id, await engine.extractTemplate(b.reference_image));
  const template = templates.get(bio.id)!;
  const gallery = d.biometrics.filter((b) => b.animal_id !== animal.id && b.embedding_reference).map((b) => ({ animalId: b.animal_id, reference: b.embedding_reference }));
  let dup = await engine.identify(template, gallery);
  for (const b of bios.slice(1)) { if (dup.matched) break; dup = await engine.identify(templates.get(b.id)!, gallery); }

  mutate((m) => {
    const newId = formatMuzzleId(m.nextSequence);
    m.nextSequence += 1;
    m.animals = m.animals.map((a) => (a.id === animal.id ? { ...a, muzzle_id: newId, sync_state: 'SYNCED', updated_at: nowIso() } : a));
    m.biometrics = m.biometrics.map((b) => { const t = templates.get(b.id); return t ? { ...b, embedding_reference: t.reference, model_version: t.modelVersion, enrollment_quality: t.quality } : b; });
    m.movements.push({ id: uid('mov'), animal_id: animal.id, event: 'REGISTERED', description: `Synced: muzzle identity enrolled as ${newId}`, actor_name: 'MuzzleID sync', date: nowIso() });
    m.audit.unshift({ id: uid('log'), actor_id: 'system', actor_name: 'MuzzleID sync', actor_role: 'SYSTEM', action: 'ANIMAL_REGISTERED', target: newId, details: `Synced from device (was ${animal.muzzle_id})`, created_at: nowIso() });
    if (dup.matched && dup.animalId) {
      const other = m.animals.find((a) => a.id === dup.animalId);
      m.notifications.unshift({ id: uid('ntf'), user_id: animal.owner_id, kind: 'ALERT', title: 'Possible duplicate registration', body: `${newId} closely matches existing record ${other?.muzzle_id} (simulated check). An administrator will review it.`, animal_id: animal.id, read: false, created_at: nowIso() });
    }
  });
}

async function pushToServer(item: OfflineSyncQueueItem) {
  const sb = await getSupabase();
  if (!sb) {
    await sleep(450); // demo mode: simulate network round-trip
    return;
  }
  const refs = ((item.payload as { refs?: EntityRef[] })?.refs) ?? [];
  const d = dbStore.get();
  for (const r of refs) {
    const row = (d[r.table] as unknown as { id?: string; user_id?: string }[]).find((x) => (x.id ?? x.user_id) === r.id);
    if (row) await pushRow(sb, TABLES[r.table], row as Record<string, unknown>);
  }
}

export async function processQueue(): Promise<number> {
  if (running) return 0;
  const items = dbStore.get().syncQueue.filter((q) => q.status === 'PENDING' || q.status === 'FAILED');
  if (!items.length) return 0;
  running = true;
  setUI({ syncPhase: 'syncing' });
  let done = 0;
  for (const item of items) {
    mutate((d) => { d.syncQueue = d.syncQueue.map((q) => (q.id === item.id ? { ...q, status: 'SYNCING' } : q)); });
    try {
      await sleep(500);
      if (item.op === 'REGISTER_ANIMAL') await enrolPending(item);
      await pushToServer(item);
      mutate((d) => {
        d.syncQueue = d.syncQueue.map((q) => (q.id === item.id ? { ...q, status: 'SYNCED', synced_at: nowIso() } : q));
        // health/theft records created offline are now synced
        d.animals = d.animals.map((a) => (a.id === item.entity_id && a.sync_state === 'PENDING' && !a.muzzle_id.startsWith('PENDING') ? { ...a, sync_state: 'SYNCED' } : a));
      });
      done++;
    } catch (e) {
      mutate((d) => { d.syncQueue = d.syncQueue.map((q) => (q.id === item.id ? { ...q, status: 'FAILED', error: String((e as Error).message ?? e) } : q)); });
    }
  }
  // Keep queue tidy: drop synced items older than the latest 30
  mutate((d) => {
    const synced = d.syncQueue.filter((q) => q.status === 'SYNCED');
    if (synced.length > 30) { const keep = new Set(synced.slice(-30).map((q) => q.id)); d.syncQueue = d.syncQueue.filter((q) => q.status !== 'SYNCED' || keep.has(q.id)); }
  });
  running = false;
  setUI({ syncPhase: 'complete', lastSyncAt: nowIso() });
  setTimeout(() => { if (uiStore.get().syncPhase === 'complete') setUI({ syncPhase: 'idle' }); }, 3500);
  return done;
}
