// Authentication. Demo Mode: accounts stored on device (passwords hashed, demo only).
// Supabase Mode: Supabase Auth (email + password); phone-only sign-ups use a derived login email.
import type { Role, User } from '../types/models';
import { dbStore, mutate, setUI } from './store';
import { nowIso, sha256, uid } from '../lib/utils';
import { getSupabase, supabaseEnabled } from './supabase';

const normPhone = (p: string) => p.replace(/\D/g, '');
const phoneEmail = (p: string) => `${normPhone(p)}@phone.muzzleid.app`;

function findLocal(identifier: string): User | undefined {
  const id = identifier.trim().toLowerCase();
  return dbStore.get().users.find((u) => (u.email && u.email.toLowerCase() === id) || (normPhone(id).length > 5 && normPhone(u.phone) === normPhone(id)));
}

function audit(user: User, action: string) {
  mutate((d) => d.audit.unshift({ id: uid('log'), actor_id: user.id, actor_name: user.full_name, actor_role: user.role, action, created_at: nowIso() }));
}

export async function signIn(identifier: string, password: string): Promise<User> {
  const sb = await getSupabase();
  if (sb) {
    const email = identifier.includes('@') ? identifier.trim() : phoneEmail(identifier);
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error || !data.user) throw new Error(error?.message || 'Sign in failed');
    const { data: profile } = await sb.from('profiles').select('*').eq('id', data.user.id).single();
    const user: User = { id: data.user.id, role: (profile?.role as Role) || 'FARMER', full_name: profile?.full_name || email, phone: profile?.phone || '', email, active: true, is_demo: false, created_at: nowIso() };
    mutate((d) => { d.users = [...d.users.filter((u) => u.id !== user.id), user]; });
    setUI({ sessionUserId: user.id });
    return user;
  }
  const u = findLocal(identifier);
  if (!u || !u.password_hash || u.password_hash !== (await sha256(password))) throw new Error('Phone/email or password is incorrect.');
  if (!u.active) throw new Error('This account has been deactivated by an administrator.');
  setUI({ sessionUserId: u.id });
  audit(u, 'SIGNED_IN');
  return u;
}

export function demoSignIn(userId: string) {
  const u = dbStore.get().users.find((x) => x.id === userId);
  if (!u) throw new Error('Demo account not found');
  setUI({ sessionUserId: u.id });
  audit(u, 'SIGNED_IN_DEMO');
  return u;
}

export interface SignUpInput { full_name: string; phone: string; email?: string; farm_name: string; region: string; password: string; role: Role; organisation?: string }

export async function signUp(input: SignUpInput): Promise<User> {
  if (findLocal(input.phone) || (input.email && findLocal(input.email))) throw new Error('An account with this phone or email already exists.');
  const sb = await getSupabase();
  let id = uid('u');
  if (sb) {
    const email = input.email?.trim() || phoneEmail(input.phone);
    const { data, error } = await sb.auth.signUp({ email, password: input.password, options: { data: { full_name: input.full_name, phone: input.phone, role: input.role } } });
    if (error || !data.user) throw new Error(error?.message || 'Sign up failed');
    id = data.user.id;
    await sb.from('profiles').upsert({ id, full_name: input.full_name, phone: input.phone, email: input.email || null, role: input.role, organisation: input.organisation || null });
    if (input.role === 'FARMER') await sb.from('farmer_profiles').upsert({ user_id: id, farm_name: input.farm_name, region: input.region });
  }
  const user: User = {
    id, role: input.role, full_name: input.full_name.trim(), phone: input.phone.trim(), email: input.email?.trim() || undefined,
    organisation: input.organisation, active: true, is_demo: !supabaseEnabled(), password_hash: sb ? undefined : await sha256(input.password), created_at: nowIso(),
  };
  mutate((d) => {
    d.users.push(user);
    if (input.role === 'FARMER') d.farmerProfiles.push({ user_id: id, farm_name: input.farm_name.trim(), region: input.region });
    d.audit.unshift({ id: uid('log'), actor_id: id, actor_name: user.full_name, actor_role: user.role, action: 'ACCOUNT_CREATED', created_at: nowIso() });
  });
  setUI({ sessionUserId: id });
  return user;
}

export async function requestPasswordReset(identifier: string): Promise<'sent' | 'demo'> {
  const sb = await getSupabase();
  if (sb) {
    const email = identifier.includes('@') ? identifier.trim() : phoneEmail(identifier);
    await sb.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/#/signin` });
    return 'sent';
  }
  return 'demo';
}

export async function signOut() {
  const sb = await getSupabase();
  if (sb) await sb.auth.signOut();
  setUI({ sessionUserId: null });
}
