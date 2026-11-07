// All state-changing operations. Each one: updates the on-device store, writes an audit log entry,
// and queues the change for server sync (immediately when online, later when offline).
import type {
  Animal, AnimalDocument, DB, HealthRecord, HealthState, MovementRecord, OfflineSyncQueueItem, Role, Sex, SyncOp,
  TransferRequest, User, VerificationScan,
} from '../types/models';
import { mutate, dbStore } from './store';
import { nowIso, uid } from '../lib/utils';
import { currentOwnership, getAnimal, farmerProfile } from './queries';
import { supabaseEnabled } from './supabase';

export type TableKey = 'animals' | 'biometrics' | 'ownership' | 'health' | 'vaccinations' | 'movements' | 'theftReports'
  | 'scans' | 'transfers' | 'documents' | 'audit' | 'notifications' | 'users' | 'farmerProfiles';
export interface EntityRef { table: TableKey; id: string }

export const formatMuzzleId = (n: number) => `MZ-NA-${String(n).padStart(6, '0')}`;

// ---------- internal helpers ----------
function audit(d: DB, actor: User | null, action: string, target?: string, details?: string) {
  d.audit.unshift({
    id: uid('log'), actor_id: actor?.id ?? 'system', actor_name: actor?.full_name ?? 'System',
    actor_role: actor?.role ?? 'SYSTEM', action, target, details, created_at: nowIso(),
  });
}

function notify(d: DB, userId: string | undefined, n: Omit<DB['notifications'][number], 'id' | 'user_id' | 'read' | 'created_at'>) {
  if (!userId) return;
  d.notifications.unshift({ id: uid('ntf'), user_id: userId, read: false, created_at: nowIso(), ...n });
}

function move(d: DB, m: Omit<MovementRecord, 'id' | 'date'> & { date?: string }) {
  d.movements.push({ id: uid('mov'), date: m.date ?? nowIso(), ...m });
}

function patchAnimal(d: DB, id: string, patch: Partial<Animal>) {
  d.animals = d.animals.map((a) => (a.id === id ? { ...a, ...patch, updated_at: nowIso() } : a));
}

/**
 * Queue changes for the server. Demo mode (no Supabase) + online: local store is the source of truth,
 * so nothing needs queueing. Offline: always queue so the user sees PENDING SYNC.
 */
function enqueue(d: DB, online: boolean, op: SyncOp, entityId: string, label: string, refs: EntityRef[]) {
  if (online && !supabaseEnabled()) return;
  const item: OfflineSyncQueueItem = {
    id: uid('q'), op, entity_id: entityId, label, payload: { refs }, status: 'PENDING', created_at: nowIso(),
  };
  d.syncQueue.push(item);
}

// ---------- registration ----------
export interface RegisterInput {
  name?: string; ear_tag: string; breed: string; sex: Sex; birth_date: string; colour: string; farm: string; region: string;
}

export function registerAnimal(actor: User, input: RegisterInput, opts: {
  muzzleImage: string; photo?: string; template?: { reference: string; quality: number; modelVersion: string }; online: boolean;
  /** Additional angles captured during guided enrolment. */
  extras?: { image: string; template?: { reference: string; quality: number; modelVersion: string } }[];
}): Animal {
  let created!: Animal;
  mutate((d) => {
    const id = uid('a');
    const t = nowIso();
    const online = opts.online && !!opts.template;
    const muzzle_id = online ? formatMuzzleId(d.nextSequence) : `PENDING-${id.slice(-5).toUpperCase()}`;
    if (online) d.nextSequence += 1;
    created = {
      id, muzzle_id, owner_id: actor.id, ear_tag: input.ear_tag.trim().toUpperCase(), name: input.name?.trim() || undefined,
      breed: input.breed, sex: input.sex, colour: input.colour, birth_date: input.birth_date, region: input.region, farm: input.farm,
      status: 'ACTIVE', health_status: 'HEALTHY', photo_url: opts.photo || opts.muzzleImage, is_demo: false,
      sync_state: online ? 'SYNCED' : 'PENDING', created_at: t, updated_at: t,
    };
    d.animals.unshift(created);
    const bioId = uid('bio');
    d.biometrics.push({
      id: bioId, animal_id: id, reference_image: opts.muzzleImage, embedding_reference: opts.template?.reference ?? '',
      model_version: opts.template?.modelVersion ?? 'pending', enrollment_quality: opts.template?.quality ?? 0, created_at: t,
    });
    const extraIds: string[] = [];
    for (const x of (opts.extras ?? []).slice(0, MAX_ANGLES - 1)) {
      const xid = uid('bio'); extraIds.push(xid);
      d.biometrics.push({ id: xid, animal_id: id, reference_image: x.image, embedding_reference: x.template?.reference ?? '', model_version: x.template?.modelVersion ?? 'pending', enrollment_quality: x.template?.quality ?? 0, created_at: t });
    }
    const ownId = uid('own');
    d.ownership.push({
      id: ownId, animal_id: id, owner_id: actor.id, owner_name: actor.full_name, owner_phone: actor.phone,
      farm: input.farm, region: input.region, start_date: t,
    });
    move(d, { animal_id: id, event: 'REGISTERED', description: online ? 'Muzzle identity enrolled' : 'Captured offline — awaiting sync', location: `${input.farm}, ${input.region}`, actor_name: actor.full_name });
    audit(d, actor, online ? 'ANIMAL_REGISTERED' : 'ANIMAL_CAPTURED_OFFLINE', muzzle_id, `${input.breed}, ${input.sex}, tag ${created.ear_tag}`);
    enqueue(d, online, 'REGISTER_ANIMAL', id, `Register ${input.breed} (tag ${created.ear_tag})`, [
      { table: 'animals', id }, { table: 'biometrics', id: bioId }, ...extraIds.map((x) => ({ table: 'biometrics' as const, id: x })), { table: 'ownership', id: ownId },
    ]);
  });
  return created;
}

// ---------- extra muzzle angles ----------
export const MAX_ANGLES = 5;
/** Store another muzzle photo (different angle) for an animal. The matcher compares against every stored view. */
export function addMuzzleAngle(actor: User, animalId: string, image: string, template: { reference: string; quality: number; modelVersion: string }, online: boolean): boolean {
  let added = false;
  mutate((d) => {
    const a = getAnimal(d, animalId);
    if (!a || !template.reference) return;
    if (d.biometrics.filter((b) => b.animal_id === animalId).length >= MAX_ANGLES) return;
    const bioId = uid('bio');
    d.biometrics.push({ id: bioId, animal_id: animalId, reference_image: image, embedding_reference: template.reference, model_version: template.modelVersion, enrollment_quality: template.quality, created_at: nowIso() });
    audit(d, actor, 'MUZZLE_ANGLE_ADDED', a.muzzle_id, 'Additional muzzle angle enrolled');
    enqueue(d, online, 'REGISTER_ANIMAL', animalId, `Add muzzle angle (${a.muzzle_id})`, [{ table: 'biometrics', id: bioId }]);
    added = true;
  });
  return added;
}

// ---------- scans ----------
export function recordScan(actor: User, s: Omit<VerificationScan, 'id' | 'created_at' | 'scanned_by_id' | 'scanned_by_role'>, online: boolean) {
  mutate((d) => {
    const scan: VerificationScan = { ...s, id: uid('scan'), scanned_by_id: actor.id, scanned_by_role: actor.role, created_at: nowIso() };
    d.scans.unshift(scan);
    const a = s.animal_id ? getAnimal(d, s.animal_id) : undefined;
    const action = s.result === 'ALERT' ? 'SCAN_ALERT' : s.result === 'MATCH' ? 'SCAN_MATCH' : s.result === 'LOCAL_LOOKUP' ? 'LOCAL_LOOKUP' : 'SCAN_NO_MATCH';
    audit(d, actor, action, a?.muzzle_id, s.result === 'ALERT' ? 'Scan matched a stolen/missing record (simulated)' : s.confidence ? `Simulated confidence ${s.confidence}%` : undefined);
    if (a && s.result !== 'LOCAL_LOOKUP' && actor.role !== 'FARMER') {
      move(d, { animal_id: a.id, event: 'VERIFIED', description: `Identity verified by ${actor.role === 'VET' ? 'veterinary' : 'verification'} user (simulated match)`, actor_name: actor.full_name });
    }
    if (a && s.result === 'ALERT' && a.owner_id !== actor.id) {
      notify(d, a.owner_id, { kind: 'ALERT', title: 'Scan match on your reported animal', body: `${a.muzzle_id} was scanned by ${actor.full_name} (${actor.role.toLowerCase()}). Check Alerts to follow up.`, animal_id: a.id });
    }
    enqueue(d, online, 'GENERIC', scan.id, 'Verification scan', [{ table: 'scans', id: scan.id }]);
  });
}

// ---------- health ----------
export interface HealthInput {
  type: HealthRecord['type']; title: string; medication?: string; date: string; notes?: string;
  professional_name: string; vaccine_dose?: string; next_due?: string; condition?: HealthState;
}

export function addHealthRecord(actor: User, animalId: string, input: HealthInput, online: boolean) {
  mutate((d) => {
    const id = uid('h');
    d.health.push({
      id, animal_id: animalId, type: input.type, title: input.title, medication: input.medication || undefined, date: input.date,
      recorded_by_id: actor.id, recorded_by_name: input.professional_name || actor.full_name, recorded_by_role: actor.role,
      notes: input.notes || undefined, created_at: nowIso(),
    });
    const refs: EntityRef[] = [{ table: 'health', id }];
    if (input.type === 'VACCINATION') {
      const vid = uid('v');
      d.vaccinations.push({ id: vid, health_record_id: id, vaccine: input.title, dose: input.vaccine_dose, next_due: input.next_due });
      refs.push({ table: 'vaccinations', id: vid });
    }
    const ev = input.type === 'VACCINATION' ? 'VACCINATED' : input.type === 'TREATMENT' ? 'TREATED' : 'EXAMINED';
    move(d, { animal_id: animalId, event: ev, description: input.title, actor_name: input.professional_name || actor.full_name, date: new Date(input.date).toISOString() });
    if (input.condition) patchAnimal(d, animalId, { health_status: input.condition });
    const a = getAnimal(d, animalId);
    audit(d, actor, 'HEALTH_RECORD_ADDED', a?.muzzle_id, `${input.type.toLowerCase()}: ${input.title}`);
    if (a && a.owner_id !== actor.id) notify(d, a.owner_id, { kind: 'INFO', title: 'Health record added', body: `${input.title} recorded for ${a.muzzle_id} by ${actor.full_name}.`, animal_id: a.id });
    enqueue(d, online, 'ADD_HEALTH_RECORD', id, `Health record: ${input.title}`, [...refs, { table: 'animals', id: animalId }]);
  });
}

// ---------- theft / missing ----------
export function reportTheft(actor: User, animalId: string, input: { type: 'STOLEN' | 'MISSING'; last_seen_date: string; last_seen_location: string; description: string }, online: boolean) {
  mutate((d) => {
    const id = uid('tr');
    d.theftReports.push({ id, animal_id: animalId, type: input.type, reported_at: nowIso(), last_seen_date: input.last_seen_date, last_seen_location: input.last_seen_location, description: input.description, status: 'OPEN', reported_by_id: actor.id });
    patchAnimal(d, animalId, { status: input.type });
    move(d, { animal_id: animalId, event: input.type === 'STOLEN' ? 'REPORTED_STOLEN' : 'REPORTED_MISSING', description: input.description || `Reported ${input.type.toLowerCase()}`, location: input.last_seen_location, actor_name: actor.full_name });
    const a = getAnimal(d, animalId);
    audit(d, actor, 'THEFT_REPORTED', a?.muzzle_id, `Reported ${input.type}`);
    // cancel any pending transfer
    d.transfers = d.transfers.map((t) => (t.animal_id === animalId && t.status === 'PENDING' ? { ...t, status: 'CANCELLED' } : t));
    enqueue(d, online, 'REPORT_THEFT', id, `Report ${input.type.toLowerCase()}: ${a?.muzzle_id}`, [{ table: 'theftReports', id }, { table: 'animals', id: animalId }]);
  });
}

export function markRecovered(actor: User, animalId: string, note: string, online: boolean) {
  mutate((d) => {
    const reports = d.theftReports.filter((t) => t.animal_id === animalId && t.status === 'OPEN');
    d.theftReports = d.theftReports.map((t) => (t.animal_id === animalId && t.status === 'OPEN' ? { ...t, status: 'RESOLVED', resolved_at: nowIso() } : t));
    patchAnimal(d, animalId, { status: 'ACTIVE' });
    move(d, { animal_id: animalId, event: 'RECOVERED', description: note || 'Animal recovered and returned to herd', actor_name: actor.full_name });
    const a = getAnimal(d, animalId);
    audit(d, actor, 'ANIMAL_RECOVERED', a?.muzzle_id);
    enqueue(d, online, 'GENERIC', animalId, `Recovered: ${a?.muzzle_id}`, [...reports.map((r) => ({ table: 'theftReports' as const, id: r.id })), { table: 'animals', id: animalId }]);
  });
}

// ---------- ownership transfer ----------
export function createTransfer(actor: User, animalId: string, buyer: { name: string; phone: string; userId?: string }, online: boolean): TransferRequest {
  let tr!: TransferRequest;
  mutate((d) => {
    tr = { id: uid('t'), animal_id: animalId, seller_id: actor.id, buyer_name: buyer.name, buyer_phone: buyer.phone, buyer_user_id: buyer.userId, status: 'PENDING', created_at: nowIso() };
    d.transfers.unshift(tr);
    patchAnimal(d, animalId, { status: 'TRANSFER_PENDING' });
    const a = getAnimal(d, animalId);
    move(d, { animal_id: animalId, event: 'TRANSFER_REQUESTED', description: `Transfer requested to ${buyer.name}`, actor_name: actor.full_name });
    audit(d, actor, 'TRANSFER_REQUESTED', a?.muzzle_id, `To ${buyer.name} (${buyer.phone})`);
    notify(d, buyer.userId, { kind: 'TRANSFER', title: 'Incoming ownership transfer', body: `${actor.full_name} wants to transfer ${a?.muzzle_id} (${a?.breed}) to you.`, animal_id: animalId, transfer_id: tr.id });
    enqueue(d, online, 'GENERIC', tr.id, `Transfer request ${a?.muzzle_id}`, [{ table: 'transfers', id: tr.id }, { table: 'animals', id: animalId }]);
  });
  return tr;
}

/** Buyer accepts. `acceptingUser` is the buyer account (or the seller confirming on behalf of an off-platform buyer in the prototype). */
export function acceptTransfer(acceptingUser: User, transferId: string, online: boolean) {
  mutate((d) => {
    const tr = d.transfers.find((t) => t.id === transferId);
    if (!tr || tr.status !== 'PENDING') return;
    const a = getAnimal(d, tr.animal_id);
    if (!a) return;
    const t = nowIso();
    const seller = d.users.find((u) => u.id === tr.seller_id);
    // Buyer account: existing user, or create a lightweight prototype account for an off-platform buyer
    let buyerId = tr.buyer_user_id;
    if (!buyerId) {
      const existing = d.users.find((u) => u.phone.replace(/\D/g, '') === tr.buyer_phone.replace(/\D/g, ''));
      if (existing) buyerId = existing.id;
      else {
        buyerId = uid('u');
        d.users.push({ id: buyerId, role: 'FARMER', full_name: tr.buyer_name, phone: tr.buyer_phone, active: true, is_demo: true, created_at: t });
        d.farmerProfiles.push({ user_id: buyerId, farm_name: `${tr.buyer_name.split(' ')[0]}'s farm`, region: a.region });
      }
    }
    const buyerProfile = farmerProfile(d, buyerId);
    const cur = currentOwnership(d, a.id);
    d.ownership = d.ownership.map((o) => (cur && o.id === cur.id ? { ...o, end_date: t } : o));
    const newOwn = uid('own');
    d.ownership.push({
      id: newOwn, animal_id: a.id, owner_id: buyerId, owner_name: tr.buyer_name, owner_phone: tr.buyer_phone,
      farm: buyerProfile?.farm_name ?? a.farm, region: buyerProfile?.region ?? a.region, start_date: t, via_transfer_id: tr.id,
    });
    d.transfers = d.transfers.map((x) => (x.id === tr.id ? { ...x, status: 'ACCEPTED', completed_at: t, buyer_user_id: buyerId } : x));
    patchAnimal(d, a.id, { owner_id: buyerId, status: 'ACTIVE', farm: buyerProfile?.farm_name ?? a.farm, region: buyerProfile?.region ?? a.region });
    move(d, { animal_id: a.id, event: 'OWNERSHIP_TRANSFERRED', description: `Ownership transferred from ${seller?.full_name ?? 'seller'} to ${tr.buyer_name}`, location: buyerProfile ? `${buyerProfile.farm_name}, ${buyerProfile.region}` : undefined, actor_name: acceptingUser.full_name });
    audit(d, acceptingUser, 'TRANSFER_ACCEPTED', a.muzzle_id, `${seller?.full_name} → ${tr.buyer_name}`);
    notify(d, tr.seller_id, { kind: 'TRANSFER', title: 'Transfer complete', body: `${tr.buyer_name} accepted ownership of ${a.muzzle_id}.`, animal_id: a.id, transfer_id: tr.id });
    notify(d, buyerId, { kind: 'TRANSFER', title: 'Transfer complete', body: `You are now the registered owner of ${a.muzzle_id}.`, animal_id: a.id, transfer_id: tr.id });
    enqueue(d, online, 'GENERIC', tr.id, `Transfer accepted ${a.muzzle_id}`, [{ table: 'transfers', id: tr.id }, { table: 'animals', id: a.id }, { table: 'ownership', id: newOwn }]);
  });
}

export function closeTransfer(actor: User, transferId: string, status: 'DECLINED' | 'CANCELLED', online: boolean) {
  mutate((d) => {
    const tr = d.transfers.find((t) => t.id === transferId);
    if (!tr || tr.status !== 'PENDING') return;
    d.transfers = d.transfers.map((x) => (x.id === transferId ? { ...x, status, completed_at: nowIso() } : x));
    patchAnimal(d, tr.animal_id, { status: 'ACTIVE' });
    const a = getAnimal(d, tr.animal_id);
    audit(d, actor, status === 'DECLINED' ? 'TRANSFER_DECLINED' : 'TRANSFER_CANCELLED', a?.muzzle_id);
    notify(d, status === 'DECLINED' ? tr.seller_id : tr.buyer_user_id, { kind: 'TRANSFER', title: `Transfer ${status.toLowerCase()}`, body: `Transfer of ${a?.muzzle_id} was ${status.toLowerCase()}.`, animal_id: tr.animal_id });
    enqueue(d, online, 'GENERIC', tr.id, `Transfer ${status.toLowerCase()}`, [{ table: 'transfers', id: tr.id }, { table: 'animals', id: tr.animal_id }]);
  });
}

// ---------- contact owner (privacy-preserving relay) ----------
export function contactOwner(actor: User, animalId: string, message: string, callbackPhone: string) {
  mutate((d) => {
    const a = getAnimal(d, animalId);
    if (!a) return;
    notify(d, a.owner_id, { kind: 'CONTACT', title: `Message about ${a.muzzle_id}`, body: `${actor.full_name}${actor.organisation ? ` (${actor.organisation})` : ''}: “${message}” — Call back: ${callbackPhone}`, animal_id: a.id });
    audit(d, actor, 'OWNER_CONTACTED', a.muzzle_id, 'Message relayed via MuzzleID; owner phone not disclosed');
  });
}

// ---------- documents ----------
export function addDocument(actor: User, animalId: string, kind: AnimalDocument['kind'], file: { name: string; size: number }, online: boolean) {
  mutate((d) => {
    const id = uid('doc');
    d.documents.unshift({ id, animal_id: animalId, kind, file_name: file.name, size_kb: Math.max(1, Math.round(file.size / 1024)), uploaded_by_name: actor.full_name, uploaded_at: nowIso() });
    const a = getAnimal(d, animalId);
    audit(d, actor, 'DOCUMENT_UPLOADED', a?.muzzle_id, `${kind.toLowerCase()} document: ${file.name}`);
    enqueue(d, online, 'GENERIC', id, `Document ${file.name}`, [{ table: 'documents', id }]);
  });
}

// ---------- notifications ----------
export function markNotificationsRead(userId: string) {
  mutate((d) => { d.notifications = d.notifications.map((n) => (n.user_id === userId && !n.read ? { ...n, read: true } : n)); });
}

// ---------- admin ----------
export function setUserActive(admin: User, userId: string, active: boolean) {
  mutate((d) => {
    d.users = d.users.map((u) => (u.id === userId ? { ...u, active } : u));
    const u = d.users.find((x) => x.id === userId);
    audit(d, admin, active ? 'USER_ACTIVATED' : 'USER_DEACTIVATED', u?.full_name);
  });
}

export function createPrototypeUser(admin: User, input: { full_name: string; phone: string; role: Role; organisation?: string }) {
  mutate((d) => {
    const id = uid('u');
    d.users.push({ id, role: input.role, full_name: input.full_name, phone: input.phone, organisation: input.organisation, active: true, is_demo: true, created_at: nowIso(), password_hash: dbStore.get().users[0]?.password_hash });
    audit(d, admin, 'USER_CREATED', input.full_name, `Role ${input.role} (prototype; password demo1234)`);
  });
}

export function reviewRegistration(admin: User, animalId: string, decision: 'REVIEWED' | 'FLAGGED') {
  mutate((d) => {
    const a = getAnimal(d, animalId);
    audit(d, admin, decision === 'REVIEWED' ? 'REGISTRATION_REVIEWED' : 'REGISTRATION_FLAGGED', a?.muzzle_id);
    if (decision === 'FLAGGED' && a) notify(d, a.owner_id, { kind: 'INFO', title: 'Registration needs attention', body: `An administrator flagged ${a.muzzle_id} for review. Please check the muzzle photo and details.`, animal_id: a.id });
  });
}
