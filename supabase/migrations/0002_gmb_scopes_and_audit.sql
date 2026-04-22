-- Add normalized scopes array on connected_accounts + simple audit log for token refresh failures
alter table public.connected_accounts
  add column if not exists scopes_array text[] default '{}'::text[];

-- Track token refresh failures so we know when a client needs to reconnect
create table if not exists public.token_refresh_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  connected_account_id uuid not null references public.connected_accounts(id) on delete cascade,
  success boolean not null,
  error_message text,
  created_at timestamptz not null default now()
);

alter table public.token_refresh_log enable row level security;

create policy "users read own refresh log" on public.token_refresh_log
  for select using (auth.uid() = user_id);

-- Only service role writes to this table, so no insert/update/delete policies for regular users.

create index if not exists idx_token_refresh_log_user on public.token_refresh_log(user_id, created_at desc);
create index if not exists idx_token_refresh_log_account on public.token_refresh_log(connected_account_id, created_at desc);
