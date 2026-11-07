-- MuzzleID — Supabase schema (Postgres) with Row Level Security.
-- Run in the Supabase SQL editor. IDs are text so records created offline on a device keep their IDs on sync.

-- ============ Helpers ============

-- ============ Users / profiles ============
create table if not exists public.profiles (
  id text primary key,                         -- = auth.users.id::text
  role text not null default 'FARMER' check (role in ('FARMER','VET','VERIFIER','ADMIN')),
  full_name text not null,
  phone text not null,
  email text,
  organisation text,
  active boolean not null default true,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

create or replace function public.current_role_name() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()::text
$$;

create table if not exists public.farmer_profiles (
  user_id text primary key references public.profiles(id) on delete cascade,
  farm_name text not null,
  region text not null
);

-- ============ Animals ============
create table if not exists public.animals (
  id text primary key,
  muzzle_id text not null unique,              -- MZ-NA-000847 (PENDING-xxxx only on device, never synced as final)
  owner_id text not null references public.profiles(id),
  ear_tag text not null,
  name text,
  breed text not null,
  sex text not null check (sex in ('Female','Male')),
  colour text,
  birth_date text,
  region text not null,
  farm text not null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','MISSING','STOLEN','TRANSFER_PENDING')),
  health_status text not null default 'HEALTHY' check (health_status in ('HEALTHY','UNDER_TREATMENT','NEEDS_ATTENTION')),
  photo_url text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists animals_owner_idx on public.animals(owner_id);
create index if not exists animals_ear_tag_idx on public.animals(ear_tag);

create table if not exists public.muzzle_biometrics (
  id text primary key,
  animal_id text not null references public.animals(id) on delete cascade,
  reference_image text,                        -- storage URL (bucket: livestock/muzzles)
  embedding_reference text,                    -- simulator: perceptual hash; production: embedding id / vector ref
  model_version text not null,
  enrollment_quality real,
  created_at timestamptz not null default now()
);

create table if not exists public.ownership_records (
  id text primary key,
  animal_id text not null references public.animals(id) on delete cascade,
  owner_id text references public.profiles(id),
  owner_name text not null,
  owner_phone text not null,
  farm text,
  region text,
  start_date timestamptz not null,
  end_date timestamptz,
  via_transfer_id text
);

create table if not exists public.health_records (
  id text primary key,
  animal_id text not null references public.animals(id) on delete cascade,
  type text not null check (type in ('VACCINATION','TREATMENT','EXAMINATION','TEST_NOTE')),
  title text not null,
  medication text,
  date timestamptz not null,
  recorded_by_id text not null,
  recorded_by_name text not null,
  recorded_by_role text not null,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.vaccination_records (
  id text primary key,
  health_record_id text not null references public.health_records(id) on delete cascade,
  vaccine text not null,
  dose text,
  batch text,
  next_due timestamptz
);

create table if not exists public.movement_records (
  id text primary key,
  animal_id text not null references public.animals(id) on delete cascade,
  event text not null,
  description text,
  location text,
  actor_name text,
  date timestamptz not null default now()
);

create table if not exists public.theft_reports (
  id text primary key,
  animal_id text not null references public.animals(id) on delete cascade,
  type text not null check (type in ('STOLEN','MISSING')),
  reported_at timestamptz not null default now(),
  last_seen_date text,
  last_seen_location text,
  description text,
  status text not null default 'OPEN' check (status in ('OPEN','RESOLVED')),
  reported_by_id text not null,
  resolved_at timestamptz
);

create table if not exists public.verification_scans (
  id text primary key,
  animal_id text references public.animals(id) on delete set null,
  scanned_by_id text not null,
  scanned_by_role text not null,
  result text not null check (result in ('MATCH','NO_MATCH','ALERT','LOCAL_LOOKUP')),
  confidence real,
  simulated boolean not null default true,
  mode text not null default 'SERVER',
  created_at timestamptz not null default now()
);

create table if not exists public.transfer_requests (
  id text primary key,
  animal_id text not null references public.animals(id) on delete cascade,
  seller_id text not null references public.profiles(id),
  buyer_name text not null,
  buyer_phone text not null,
  buyer_user_id text references public.profiles(id),
  status text not null default 'PENDING' check (status in ('PENDING','ACCEPTED','DECLINED','CANCELLED')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.animal_documents (
  id text primary key,
  animal_id text not null references public.animals(id) on delete cascade,
  kind text not null check (kind in ('VETERINARY','OWNERSHIP','VACCINATION')),
  file_name text not null,
  size_kb int,
  uploaded_by_name text,
  uploaded_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id text primary key,
  actor_id text not null,
  actor_name text not null,
  actor_role text not null,
  action text not null,
  target text,
  details text,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id text primary key,
  user_id text not null references public.profiles(id) on delete cascade,
  kind text not null,
  title text not null,
  body text,
  animal_id text,
  transfer_id text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.offline_sync_queue (   -- server-side receipt of device sync batches (optional)
  id text primary key,
  user_id text not null,
  op text not null,
  entity_id text not null,
  status text not null,
  created_at timestamptz not null default now(),
  synced_at timestamptz
);

-- ============ Privacy-limited view for verification ============
-- Exposes status + description, never owner phone.
create or replace view public.animal_verification_view as
select a.id, a.muzzle_id, a.ear_tag, a.breed, a.sex, a.colour, a.region, a.status, a.photo_url,
       o.owner_name, o.start_date as ownership_start,
       (select t.reported_at from public.theft_reports t where t.animal_id = a.id and t.status = 'OPEN' limit 1) as open_report_at,
       a.created_at as registered_at
from public.animals a
left join public.ownership_records o on o.animal_id = a.id and o.end_date is null;

-- Supabase grants new public objects to anon/authenticated by default, and a view bypasses the RLS of its tables.
-- This view shows owner names, so only the service role (the `lookup` Edge Function) may read it.
revoke all on public.animal_verification_view from anon, authenticated;

-- ============ Row Level Security ============
alter table public.profiles enable row level security;
alter table public.farmer_profiles enable row level security;
alter table public.animals enable row level security;
alter table public.muzzle_biometrics enable row level security;
alter table public.ownership_records enable row level security;
alter table public.health_records enable row level security;
alter table public.vaccination_records enable row level security;
alter table public.movement_records enable row level security;
alter table public.theft_reports enable row level security;
alter table public.verification_scans enable row level security;
alter table public.transfer_requests enable row level security;
alter table public.animal_documents enable row level security;
alter table public.audit_logs enable row level security;
alter table public.notifications enable row level security;
alter table public.offline_sync_queue enable row level security;

-- Profiles: self + admin
create policy profiles_self on public.profiles for select using (id = auth.uid()::text or public.current_role_name() = 'ADMIN');
create policy profiles_insert_self on public.profiles for insert with check (id = auth.uid()::text and role in ('FARMER','VET','VERIFIER'));
create policy profiles_update_self on public.profiles for update using (id = auth.uid()::text or public.current_role_name() = 'ADMIN');
create policy farmer_profiles_rw on public.farmer_profiles for all using (user_id = auth.uid()::text or public.current_role_name() = 'ADMIN') with check (user_id = auth.uid()::text);

-- Animals: owners manage their own; vets/verifiers/admin can read (identification); only owners insert.
create policy animals_read on public.animals for select using (
  owner_id = auth.uid()::text or public.current_role_name() in ('VET','VERIFIER','ADMIN'));
create policy animals_insert on public.animals for insert with check (owner_id = auth.uid()::text);
create policy animals_update_owner on public.animals for update using (owner_id = auth.uid()::text or public.current_role_name() in ('VET','ADMIN'));

create policy bio_read on public.muzzle_biometrics for select using (
  exists (select 1 from public.animals a where a.id = animal_id and (a.owner_id = auth.uid()::text)) or public.current_role_name() in ('VET','ADMIN'));
create policy bio_insert on public.muzzle_biometrics for insert with check (
  exists (select 1 from public.animals a where a.id = animal_id and a.owner_id = auth.uid()::text));

-- Ownership: owner, verifier (ownership checks), admin. Phones are filtered in the app; use the view for verifiers.
create policy own_read on public.ownership_records for select using (
  owner_id = auth.uid()::text or public.current_role_name() in ('VERIFIER','VET','ADMIN')
  or exists (select 1 from public.animals a where a.id = animal_id and a.owner_id = auth.uid()::text));
create policy own_write on public.ownership_records for insert with check (auth.uid() is not null);
create policy own_update on public.ownership_records for update using (
  exists (select 1 from public.animals a where a.id = animal_id and a.owner_id = auth.uid()::text) or public.current_role_name() = 'ADMIN');

-- Health: owner, vets, admin (not verifiers — they get the summary only)
create policy health_read on public.health_records for select using (
  public.current_role_name() in ('VET','ADMIN') or exists (select 1 from public.animals a where a.id = animal_id and a.owner_id = auth.uid()::text));
create policy health_insert on public.health_records for insert with check (
  public.current_role_name() in ('VET','ADMIN') or exists (select 1 from public.animals a where a.id = animal_id and a.owner_id = auth.uid()::text));
create policy vacc_read on public.vaccination_records for select using (exists (select 1 from public.health_records h where h.id = health_record_id));
create policy vacc_insert on public.vaccination_records for insert with check (exists (select 1 from public.health_records h where h.id = health_record_id));

create policy mov_read on public.movement_records for select using (
  public.current_role_name() in ('VET','VERIFIER','ADMIN') or exists (select 1 from public.animals a where a.id = animal_id and a.owner_id = auth.uid()::text));
create policy mov_insert on public.movement_records for insert with check (auth.uid() is not null);

-- Theft reports: visible to all signed-in users (needed for alerts), created by owners
create policy theft_read on public.theft_reports for select using (auth.uid() is not null);
create policy theft_insert on public.theft_reports for insert with check (reported_by_id = auth.uid()::text);
create policy theft_update on public.theft_reports for update using (reported_by_id = auth.uid()::text or public.current_role_name() = 'ADMIN');

create policy scans_insert on public.verification_scans for insert with check (scanned_by_id = auth.uid()::text);
create policy scans_read on public.verification_scans for select using (scanned_by_id = auth.uid()::text or public.current_role_name() = 'ADMIN');

create policy transfers_read on public.transfer_requests for select using (seller_id = auth.uid()::text or buyer_user_id = auth.uid()::text or public.current_role_name() = 'ADMIN');
create policy transfers_insert on public.transfer_requests for insert with check (seller_id = auth.uid()::text);
create policy transfers_update on public.transfer_requests for update using (seller_id = auth.uid()::text or buyer_user_id = auth.uid()::text);

create policy docs_read on public.animal_documents for select using (
  public.current_role_name() in ('VET','ADMIN') or exists (select 1 from public.animals a where a.id = animal_id and a.owner_id = auth.uid()::text));
create policy docs_insert on public.animal_documents for insert with check (auth.uid() is not null);

create policy audit_insert on public.audit_logs for insert with check (auth.uid() is not null);
create policy audit_read on public.audit_logs for select using (public.current_role_name() = 'ADMIN' or actor_id = auth.uid()::text);

create policy notif_rw on public.notifications for select using (user_id = auth.uid()::text);
create policy notif_update on public.notifications for update using (user_id = auth.uid()::text);
create policy notif_insert on public.notifications for insert with check (auth.uid() is not null);

create policy queue_rw on public.offline_sync_queue for all using (user_id = auth.uid()::text) with check (user_id = auth.uid()::text);

-- ============ Storage ============
-- Create a bucket named 'livestock' (Storage > New bucket). Recommended: private bucket + signed URLs in production.

-- ============ Text-channel lookups (SMS / WhatsApp / USSD) ============
-- Written and read only by the `lookup` Edge Function (service role). Stores a salted hash of the sender
-- number, never the number itself, so lookups can be rate-limited without keeping phone numbers.
create table if not exists public.lookup_log (
  id bigint generated always as identity primary key,
  channel text not null check (channel in ('sms','whatsapp','ussd')),
  sender_hash text not null,
  query text not null,
  found boolean not null,
  created_at timestamptz not null default now()
);
create index if not exists lookup_log_sender_time on public.lookup_log (sender_hash, created_at desc);
alter table public.lookup_log enable row level security;  -- no policies: service role only
