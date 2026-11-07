// MuzzleID text-channel lookup core (SMS, WhatsApp, USSD). Pure TypeScript with no platform APIs, so the same
// code runs in the Supabase Edge Function, in the in-app phone simulator and in the tests.
//
// What a text lookup can and cannot prove: it confirms what the REGISTER says about an ID someone typed.
// It cannot confirm that the animal in front of you is that animal. Replies always say so.
// Privacy: replies never contain a phone number, address or farm name; the owner appears only as initials.

export type Channel = 'sms' | 'whatsapp' | 'ussd';
export type AnimalStatus = 'ACTIVE' | 'MISSING' | 'STOLEN' | 'TRANSFER_PENDING';

/** The privacy-limited fields a lookup may use (mirrors the animal_verification_view). */
export interface LookupRecord {
  muzzle_id: string;
  ear_tag: string;
  breed: string;
  sex: string;
  region: string;
  status: AnimalStatus;
  owner_name?: string | null;
  registered_at?: string | null; // ISO date
  open_report_at?: string | null; // ISO date of an OPEN theft/missing report
}

export type ParsedQuery =
  | { kind: 'muzzle'; value: string }
  | { kind: 'tag'; value: string }
  | { kind: 'help' }
  | { kind: 'invalid' };

export const MAX_QUERIES_PER_HOUR = 20;

const MUZZLE_RE = /\bMZ[-\s_]?NA[-\s_]?(\d{3,7})\b/i;

/** Turn whatever the person typed into a lookup. Tolerant of spacing, case and "TAG"/"EAR" prefixes. */
export function parseQuery(raw: string): ParsedQuery {
  const text = (raw ?? '').trim().replace(/\s+/g, ' ');
  if (!text) return { kind: 'help' };
  const m = MUZZLE_RE.exec(text);
  if (m) return { kind: 'muzzle', value: `MZ-NA-${m[1].padStart(6, '0')}` };
  if (/^(help|hi|hello|menu|\?|start|info)$/i.test(text)) return { kind: 'help' };
  const t = /^(?:tag|ear|eartag|ear tag)\s*[:#-]?\s*([A-Za-z0-9-]{3,16})$/i.exec(text) ?? /^([A-Za-z]{1,3}-?\d{2,8})$/i.exec(text);
  if (t) return { kind: 'tag', value: t[1].toUpperCase() };
  return { kind: 'invalid' };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmtMonth(iso?: string | null) { const d = iso ? new Date(iso) : null; return d && !isNaN(+d) ? `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}` : ''; }
function fmtDay(iso?: string | null) { const d = iso ? new Date(iso) : null; return d && !isNaN(+d) ? `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}` : ''; }

/** "Josua Hafeni Uuyuni" -> "J.U." (first and last initial only). */
export function ownerInitials(name?: string | null): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  const first = parts[0][0].toUpperCase();
  return parts.length > 1 ? `${first}.${parts[parts.length - 1][0].toUpperCase()}.` : `${first}.`;
}

/** Plain GSM-7-safe text: no emoji/accents, so one SMS segment stays 160 characters. */
export function gsmSafe(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7E\n]/g, '');
}

const clip = (s: string, n: number) => (s.length <= n ? s : s.slice(0, n - 1).trimEnd() + '.');

export const HELP_TEXT = 'MuzzleID check: send an ID like MZ-NA-000238, or TAG NA-0238. Shows register status only.';

function describe(r: LookupRecord, ch: Channel): string {
  const base = `${r.muzzle_id} ${r.breed} ${r.sex === 'Female' ? 'F' : r.sex === 'Male' ? 'M' : r.sex}, ${r.region}.`;
  const owner = ownerInitials(r.owner_name);
  const reg = fmtMonth(r.registered_at);
  const tail = ch === 'whatsapp' ? '\nThis confirms the REGISTER entry only. To confirm the animal in front of you, scan its muzzle in the MuzzleID app.' : ' ID check only: confirm animal by muzzle scan.';
  if (r.status === 'STOLEN' || r.status === 'MISSING') {
    const when = fmtDay(r.open_report_at);
    const what = r.status === 'STOLEN' ? 'REPORTED STOLEN' : 'REPORTED MISSING';
    return `ALERT ${r.muzzle_id}: ${what}${when ? ' ' + when : ''}. DO NOT BUY. Tell the police or the registered owner.`;
  }
  if (r.status === 'TRANSFER_PENDING') return `${base} Ownership transfer pending: seller and buyer must both confirm in MuzzleID.${tail}`;
  return `${base}${owner ? ' Owner ' + owner.replace(/\.?$/, '.') : ''}${reg ? ' Reg ' + reg + '.' : ''} ACTIVE, no theft report.${tail}`;
}

/** Build the reply text for a parsed query and the records found for it. */
export function formatReply(q: ParsedQuery, records: LookupRecord[], ch: Channel): string {
  let out: string;
  if (q.kind === 'help') out = HELP_TEXT;
  else if (q.kind === 'invalid') out = `Not understood. ${HELP_TEXT}`;
  else if (records.length === 0) {
    out = `No MuzzleID record for ${q.value}. That does not prove the animal is legal or stolen. Ask the seller for its MuzzleID and scan the muzzle.`;
  } else if (records.length > 1) {
    out = `${records.length} animals share tag ${q.value}. Send the full MuzzleID (MZ-NA-xxxxxx) from the animal's card.`;
  } else out = describe(records[0], ch);
  out = gsmSafe(out);
  const limit = ch === 'sms' ? 320 : ch === 'ussd' ? 170 : 1000; // sms: 2 concatenated segments at most
  return clip(out, limit);
}

// ---------- USSD session ----------
// Text arrives as the whole path so far, e.g. "" -> "1" -> "1*MZ-NA-000238" (common aggregator format).

export interface UssdStep { con: boolean; reply?: string; query?: ParsedQuery }

export function ussdRoute(text: string): UssdStep {
  const parts = (text ?? '').split('*').map((p) => p.trim());
  if (parts.length === 1 && parts[0] === '') return { con: true, reply: 'MuzzleID\n1. Check animal by ID\n2. Check by ear tag\n3. Help' };
  const [choice, entry] = parts;
  if (choice === '3') return { con: false, reply: gsmSafe(HELP_TEXT) };
  if (choice === '1' || choice === '2') {
    if (entry === undefined) return { con: true, reply: choice === '1' ? 'Enter MuzzleID (e.g. MZ-NA-000238):' : 'Enter ear tag (e.g. NA-0238):' };
    const q = choice === '1' ? parseQuery(entry) : parseQuery(/^tag/i.test(entry) ? entry : `TAG ${entry}`);
    return q.kind === 'muzzle' || q.kind === 'tag' ? { con: false, query: q } : { con: false, reply: 'Not understood. Dial again and enter an ID like MZ-NA-000238.' };
  }
  return { con: false, reply: 'Invalid choice. Dial again.' };
}

export const ussdWrap = (con: boolean, text: string) => `${con ? 'CON' : 'END'} ${text}`;
