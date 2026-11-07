// MuzzleID domain models. These mirror the Supabase schema in /supabase/schema.sql.

export type Role = 'FARMER' | 'VET' | 'VERIFIER' | 'ADMIN';

export type AnimalStatus = 'ACTIVE' | 'MISSING' | 'STOLEN' | 'TRANSFER_PENDING';
/** Display-only status for animals the viewer previously owned. */
export type DisplayStatus = AnimalStatus | 'TRANSFERRED' | 'PENDING_SYNC';

export type HealthState = 'HEALTHY' | 'UNDER_TREATMENT' | 'NEEDS_ATTENTION';
export type Sex = 'Female' | 'Male';
export type SyncState = 'SYNCED' | 'PENDING';

export interface User {
  id: string;
  role: Role;
  full_name: string;
  phone: string;
  email?: string;
  organisation?: string;
  active: boolean;
  is_demo: boolean;
  /** Local demo mode only: SHA-256 of password. Never used when Supabase auth is configured. */
  password_hash?: string;
  created_at: string;
}

export interface FarmerProfile {
  user_id: string;
  farm_name: string;
  region: string;
}

export interface Animal {
  id: string;
  muzzle_id: string; // e.g. MZ-NA-000847, or provisional PENDING-xxxx while offline
  owner_id: string;
  ear_tag: string;
  name?: string;
  breed: string;
  sex: Sex;
  colour: string;
  birth_date: string; // ISO date or year
  region: string;
  farm: string;
  status: AnimalStatus;
  health_status: HealthState;
  photo_url: string;
  is_demo: boolean;
  sync_state: SyncState;
  created_at: string;
  updated_at: string;
}

export interface MuzzleBiometricRecord {
  id: string;
  animal_id: string;
  reference_image: string;
  /** Opaque template reference. Simulator stores a perceptual hash; a real model would store an embedding id/vector. */
  embedding_reference: string;
  model_version: string;
  enrollment_quality: number; // 0..1
  created_at: string;
}

export interface OwnershipRecord {
  id: string;
  animal_id: string;
  owner_id?: string;
  owner_name: string;
  owner_phone: string;
  farm: string;
  region: string;
  start_date: string;
  end_date?: string;
  via_transfer_id?: string;
}

export type HealthType = 'VACCINATION' | 'TREATMENT' | 'EXAMINATION' | 'TEST_NOTE';

export interface HealthRecord {
  id: string;
  animal_id: string;
  type: HealthType;
  title: string;
  medication?: string;
  date: string;
  recorded_by_id: string;
  recorded_by_name: string;
  recorded_by_role: Role;
  notes?: string;
  created_at: string;
}

export interface VaccinationRecord {
  id: string;
  health_record_id: string;
  vaccine: string;
  dose?: string;
  batch?: string;
  next_due?: string;
}

export type MovementEvent =
  | 'REGISTERED'
  | 'VACCINATED'
  | 'TREATED'
  | 'EXAMINED'
  | 'TRANSFER_REQUESTED'
  | 'OWNERSHIP_TRANSFERRED'
  | 'REPORTED_MISSING'
  | 'REPORTED_STOLEN'
  | 'RECOVERED'
  | 'VERIFIED';

export interface MovementRecord {
  id: string;
  animal_id: string;
  event: MovementEvent;
  description: string;
  location?: string;
  actor_name: string;
  date: string;
}

export interface TheftReport {
  id: string;
  animal_id: string;
  type: 'STOLEN' | 'MISSING';
  reported_at: string;
  last_seen_date?: string;
  last_seen_location: string;
  description: string;
  status: 'OPEN' | 'RESOLVED';
  reported_by_id: string;
  resolved_at?: string;
}

export interface VerificationScan {
  id: string;
  animal_id?: string;
  scanned_by_id: string;
  scanned_by_role: Role;
  result: 'MATCH' | 'NO_MATCH' | 'ALERT' | 'LOCAL_LOOKUP';
  confidence?: number;
  simulated: boolean;
  mode: 'SERVER' | 'LOCAL';
  created_at: string;
}

export interface TransferRequest {
  id: string;
  animal_id: string;
  seller_id: string;
  buyer_name: string;
  buyer_phone: string;
  buyer_user_id?: string;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED';
  created_at: string;
  completed_at?: string;
}

export interface AnimalDocument {
  id: string;
  animal_id: string;
  kind: 'VETERINARY' | 'OWNERSHIP' | 'VACCINATION';
  file_name: string;
  size_kb: number;
  uploaded_by_name: string;
  uploaded_at: string;
}

export interface AuditLog {
  id: string;
  actor_id: string;
  actor_name: string;
  actor_role: Role | 'SYSTEM';
  action: string;
  target?: string;
  details?: string;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  kind: 'TRANSFER' | 'CONTACT' | 'ALERT' | 'SYNC' | 'INFO';
  title: string;
  body: string;
  animal_id?: string;
  transfer_id?: string;
  read: boolean;
  created_at: string;
}

export type SyncOp = 'REGISTER_ANIMAL' | 'ADD_HEALTH_RECORD' | 'REPORT_THEFT' | 'GENERIC';

export interface OfflineSyncQueueItem {
  id: string;
  op: SyncOp;
  entity_id: string;
  label: string;
  payload: unknown;
  status: 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED';
  created_at: string;
  synced_at?: string;
  error?: string;
}

export interface DB {
  version: number;
  users: User[];
  farmerProfiles: FarmerProfile[];
  animals: Animal[];
  biometrics: MuzzleBiometricRecord[];
  ownership: OwnershipRecord[];
  health: HealthRecord[];
  vaccinations: VaccinationRecord[];
  movements: MovementRecord[];
  theftReports: TheftReport[];
  scans: VerificationScan[];
  transfers: TransferRequest[];
  documents: AnimalDocument[];
  audit: AuditLog[];
  notifications: Notification[];
  syncQueue: OfflineSyncQueueItem[];
  nextSequence: number;
}
