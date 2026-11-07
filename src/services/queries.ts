import type { Animal, DB, DisplayStatus, OwnershipRecord, TheftReport, User } from '../types/models';

export const getUser = (db: DB, id?: string | null) => db.users.find((u) => u.id === id);
export const getAnimal = (db: DB, id?: string) => db.animals.find((a) => a.id === id);
export const farmerProfile = (db: DB, userId?: string | null) => db.farmerProfiles.find((f) => f.user_id === userId);

export const currentOwnership = (db: DB, animalId: string): OwnershipRecord | undefined =>
  db.ownership.filter((o) => o.animal_id === animalId && !o.end_date).sort((a, b) => b.start_date.localeCompare(a.start_date))[0];

export const ownershipHistory = (db: DB, animalId: string) =>
  db.ownership.filter((o) => o.animal_id === animalId).sort((a, b) => b.start_date.localeCompare(a.start_date));

export const openReport = (db: DB, animalId: string): TheftReport | undefined =>
  db.theftReports.find((t) => t.animal_id === animalId && t.status === 'OPEN');

export const pendingTransfer = (db: DB, animalId: string) =>
  db.transfers.find((t) => t.animal_id === animalId && t.status === 'PENDING');

/** Animals the farmer owns, plus animals they transferred away (shown as TRANSFERRED). */
export function herdFor(db: DB, userId: string) {
  const owned = db.animals.filter((a) => a.owner_id === userId);
  const transferredAway = db.animals.filter(
    (a) => a.owner_id !== userId && db.ownership.some((o) => o.animal_id === a.id && o.owner_id === userId && o.end_date)
  );
  return { owned, transferredAway };
}

export function displayStatus(db: DB, a: Animal, viewer?: User): DisplayStatus {
  if (a.sync_state === 'PENDING' && a.muzzle_id.startsWith('PENDING')) return 'PENDING_SYNC';
  if (viewer && a.owner_id !== viewer.id && viewer.role === 'FARMER' &&
      db.ownership.some((o) => o.animal_id === a.id && o.owner_id === viewer.id && o.end_date)) return 'TRANSFERRED';
  return a.status;
}

export function searchAnimals(list: Animal[], q: string) {
  const s = q.trim().toLowerCase().replace(/\s+/g, '');
  if (!s) return list;
  return list.filter((a) =>
    a.muzzle_id.toLowerCase().replace(/-/g, '').includes(s.replace(/-/g, '')) ||
    a.ear_tag.toLowerCase().replace(/-/g, '').includes(s.replace(/-/g, '')) ||
    (a.name || '').toLowerCase().includes(s)
  );
}

export const animalLabel = (a: Animal) => (a.name ? `${a.name} · ${a.breed}` : a.breed);

export const isToday = (iso: string) => new Date(iso).toDateString() === new Date().toDateString();
