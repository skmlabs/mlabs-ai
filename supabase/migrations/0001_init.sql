-- ============================================================================
-- mlabs-ai — initial schema
-- Multi-tenant platform. Every row belongs to a user; RLS enforces isolation.
-- ============================================================================

-- Extensions
create extension if not exists "pgcrypto";

-- ============================================================================
-- users
-- One row per auth.users. Stored separately so we can add app-level fields
-- without touching Supabase's auth schema.
-- ============================================================================
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.users enable row level security;

create policy "users can read own row" on public.users
  for select using (auth.uid() = id);

create policy "users can update own row" on public.users
  for update using (auth.uid() = id);

-- ============================================================================
-- connected_accounts
-- One row per GMB account a user has connected. Refresh token is encrypted.
-- ============================================================================
create table if not exists public.connected_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  provider text not null check (provider in ('gmb')),
  google_account_email text not null,
  google_account_name text,
  encrypted_refresh_token text not null,
  scope text not null,
  status text not null default 'active' check (status in ('active', 'revoked', 'error')),
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider, google_account_email)
);

alter table public.connected_accounts enable row level security;

create policy "users can read own connected_accounts" on public.connected_accounts
  for select using (auth.uid() = user_id);

create policy "users can insert own connected_accounts" on public.connected_accounts
  for insert with check (auth.uid() = user_id);

create policy "users can update own connected_accounts" on public.connected_accounts
  for update using (auth.uid() = user_id);

create policy "users can delete own connected_accounts" on public.connected_accounts
  for delete using (auth.uid() = user_id);

-- ============================================================================
-- locations
-- Cached list of GMB locations per connected account. Refreshed on demand.
-- ============================================================================
create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  connected_account_id uuid not null references public.connected_accounts(id) on delete cascade,
  gmb_account_id text not null,
  gmb_location_id text not null,
  location_resource_name text not null,
  title text not null,
  address text,
  primary_phone text,
  website_uri text,
  place_id text,
  latitude numeric,
  longitude numeric,
  categories jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connected_account_id, gmb_location_id)
);

alter table public.locations enable row level security;

create policy "users can read own locations" on public.locations
  for select using (auth.uid() = user_id);

create policy "users can insert own locations" on public.locations
  for insert with check (auth.uid() = user_id);

create policy "users can update own locations" on public.locations
  for update using (auth.uid() = user_id);

create policy "users can delete own locations" on public.locations
  for delete using (auth.uid() = user_id);

create index if not exists idx_locations_user on public.locations(user_id);
create index if not exists idx_locations_connected on public.locations(connected_account_id);

-- ============================================================================
-- updated_at triggers
-- ============================================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_users_updated_at on public.users;
create trigger trg_users_updated_at before update on public.users
  for each row execute function public.set_updated_at();

drop trigger if exists trg_connected_accounts_updated_at on public.connected_accounts;
create trigger trg_connected_accounts_updated_at before update on public.connected_accounts
  for each row execute function public.set_updated_at();

drop trigger if exists trg_locations_updated_at on public.locations;
create trigger trg_locations_updated_at before update on public.locations
  for each row execute function public.set_updated_at();
