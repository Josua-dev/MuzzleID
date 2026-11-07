// Optional Supabase backend. When VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set, MuzzleID runs in
// local Demo Mode: all data lives on the device and nothing is sent to a server.
import type { SupabaseClient } from '@supabase/supabase-js';
import { env } from '../lib/env';

let client: SupabaseClient | null = null;

export const supabaseEnabled = () => Boolean(env.supabaseUrl && env.supabaseAnonKey);

export async function getSupabase(): Promise<SupabaseClient | null> {
  if (!supabaseEnabled()) return null;
  if (!client) {
    const { createClient } = await import('@supabase/supabase-js');
    client = createClient(env.supabaseUrl, env.supabaseAnonKey, { auth: { persistSession: true } });
  }
  return client;
}

/** Local store collection -> Supabase table name */
export const TABLES: Record<string, string> = {
  animals: 'animals', biometrics: 'muzzle_biometrics', ownership: 'ownership_records', health: 'health_records',
  vaccinations: 'vaccination_records', movements: 'movement_records', theftReports: 'theft_reports', scans: 'verification_scans',
  transfers: 'transfer_requests', documents: 'animal_documents', audit: 'audit_logs', notifications: 'notifications',
  users: 'profiles', farmerProfiles: 'farmer_profiles',
};

const LOCAL_ONLY = new Set(['sync_state', 'password_hash']);

/** Upload a data-URL image to Storage and return its public path. */
export async function uploadImage(sb: SupabaseClient, path: string, dataUrl: string): Promise<string> {
  if (!dataUrl.startsWith('data:')) return dataUrl;
  const blob = await (await fetch(dataUrl)).blob();
  const { error } = await sb.storage.from('livestock').upload(path, blob, { upsert: true, contentType: blob.type });
  if (error) throw error;
  return sb.storage.from('livestock').getPublicUrl(path).data.publicUrl;
}

export async function pushRow(sb: SupabaseClient, table: string, row: Record<string, unknown>) {
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) if (!LOCAL_ONLY.has(k)) clean[k] = v;
  if (table === 'animals' && typeof clean.photo_url === 'string') clean.photo_url = await uploadImage(sb, `animals/${clean.id}.jpg`, clean.photo_url);
  if (table === 'muzzle_biometrics' && typeof clean.reference_image === 'string') clean.reference_image = await uploadImage(sb, `muzzles/${clean.id}.jpg`, clean.reference_image);
  const { error } = await sb.from(table).upsert(clean);
  if (error) throw error;
}
