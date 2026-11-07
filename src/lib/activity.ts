import type { AuditLog } from '../types/models';
import type { IconName } from '../components/ui/Icon';

const MAP: Record<string, { text: (l: AuditLog) => string; icon: IconName; tone: 'green' | 'red' | 'amber' | 'blue' | 'grey' }> = {
  ANIMAL_REGISTERED: { text: (l) => `${l.target} registered`, icon: 'fingerprint', tone: 'green' },
  ANIMAL_CAPTURED_OFFLINE: { text: (l) => `Registration captured offline (${l.target})`, icon: 'device', tone: 'amber' },
  HEALTH_RECORD_ADDED: { text: (l) => `${l.details?.split(':')[0] === 'vaccination' ? 'Vaccination' : 'Health record'} added to ${l.target}`, icon: 'syringe', tone: 'green' },
  THEFT_REPORTED: { text: (l) => `${l.target} reported ${l.details?.includes('STOLEN') ? 'stolen' : 'missing'}`, icon: 'alert', tone: 'red' },
  ANIMAL_RECOVERED: { text: (l) => `${l.target} recovered`, icon: 'checkCircle', tone: 'green' },
  SCAN_MATCH: { text: (l) => `${l.target} identified by scan`, icon: 'scan', tone: 'grey' },
  SCAN_ALERT: { text: (l) => `Alert: ${l.target} scanned while reported`, icon: 'alert', tone: 'red' },
  SCAN_NO_MATCH: { text: () => 'Scan: no match found', icon: 'scan', tone: 'grey' },
  LOCAL_LOOKUP: { text: (l) => `${l.target ?? 'Record'} looked up offline`, icon: 'device', tone: 'grey' },
  TRANSFER_REQUESTED: { text: (l) => `Transfer requested for ${l.target}`, icon: 'transfer', tone: 'blue' },
  TRANSFER_ACCEPTED: { text: (l) => `Transfer completed for ${l.target}`, icon: 'transfer', tone: 'blue' },
  TRANSFER_DECLINED: { text: (l) => `Transfer declined for ${l.target}`, icon: 'transfer', tone: 'grey' },
  TRANSFER_CANCELLED: { text: (l) => `Transfer cancelled for ${l.target}`, icon: 'transfer', tone: 'grey' },
  DOCUMENT_UPLOADED: { text: (l) => `Document added to ${l.target}`, icon: 'file', tone: 'grey' },
  OWNER_CONTACTED: { text: (l) => `Owner contacted about ${l.target}`, icon: 'message', tone: 'blue' },
};

export function describe(l: AuditLog) {
  const m = MAP[l.action];
  if (m) return { text: m.text(l), icon: m.icon, tone: m.tone };
  return { text: `${l.action.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}${l.target ? ` · ${l.target}` : ''}`, icon: 'activity' as IconName, tone: 'grey' as const };
}

export const TONE_CLS = {
  green: 'bg-forest-100 text-forest-800',
  red: 'bg-red-100 text-red-700',
  amber: 'bg-amber-100 text-amber-800',
  blue: 'bg-blue-100 text-blue-700',
  grey: 'bg-surface text-charcoal-700',
};
