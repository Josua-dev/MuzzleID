// Role-based capabilities and privacy rules. Server-side, the same rules are enforced with
// Row Level Security policies (see supabase/schema.sql).
import type { Animal, DB, Role, User } from '../types/models';

export const ROLE_LABEL: Record<Role, string> = {
  FARMER: 'Farmer',
  VET: 'Veterinary user',
  VERIFIER: 'Verification user',
  ADMIN: 'Administrator',
};

export const can = {
  registerAnimal: (r: Role) => r === 'FARMER',
  addHealth: (r: Role) => r === 'FARMER' || r === 'VET' || r === 'ADMIN',
  reportTheft: (r: Role) => r === 'FARMER',
  transfer: (r: Role) => r === 'FARMER',
  admin: (r: Role) => r === 'ADMIN',
};

/** How much of a record the viewer may see. */
export type Visibility = 'OWNER' | 'ADMIN' | 'VET' | 'VERIFIER' | 'LIMITED';

export function visibilityFor(user: User, animal: Animal, db: DB): Visibility {
  if (user.role === 'ADMIN') return 'ADMIN';
  if (animal.owner_id === user.id) return 'OWNER';
  if (user.role === 'VET') return 'VET';
  if (user.role === 'VERIFIER') return 'VERIFIER';
  // Previous owners keep read access to the history up to transfer
  if (db.ownership.some((o) => o.animal_id === animal.id && o.owner_id === user.id)) return 'LIMITED';
  return 'LIMITED';
}

export const rules = (v: Visibility) => ({
  ownerFullName: v !== 'LIMITED',
  ownerPhone: v === 'OWNER' || v === 'ADMIN',
  farm: v !== 'LIMITED',
  healthDetail: v === 'OWNER' || v === 'ADMIN' || v === 'VET',
  healthSummary: v !== 'LIMITED',
  fullTimeline: v === 'OWNER' || v === 'ADMIN' || v === 'VET',
  traceTimeline: v === 'VERIFIER',
  documents: v === 'OWNER' || v === 'ADMIN' || v === 'VET',
  ownershipHistory: v === 'OWNER' || v === 'ADMIN' || v === 'VERIFIER',
  canAddHealth: v === 'OWNER' || v === 'ADMIN' || v === 'VET',
  canManage: v === 'OWNER',
});

export const TRACE_EVENTS = ['REGISTERED', 'OWNERSHIP_TRANSFERRED', 'REPORTED_MISSING', 'REPORTED_STOLEN', 'RECOVERED', 'VERIFIED'];
