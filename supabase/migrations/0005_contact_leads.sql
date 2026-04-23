-- Contact Sales lead capture table.
-- Leads can come from logged-in users (user_id set) or anonymous visitors (user_id null).

create table if not exists public.contact_leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  name text not null,
  email text not null,
  phone text not null,
  company text not null,
  message text,
  source_page text,
  referrer text,
  user_agent text,
  ip_address text,
  status text not null default 'new' check (status in ('new', 'contacted', 'qualified', 'converted', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_contact_leads_created_at on public.contact_leads(created_at desc);
create index if not exists idx_contact_leads_email on public.contact_leads(email);
create index if not exists idx_contact_leads_status on public.contact_leads(status);
create index if not exists idx_contact_leads_user_id on public.contact_leads(user_id) where user_id is not null;

-- Trigger to auto-update updated_at
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end; $$;

drop trigger if exists contact_leads_touch_updated_at on public.contact_leads;
create trigger contact_leads_touch_updated_at
  before update on public.contact_leads
  for each row execute function public.touch_updated_at();

-- RLS: only service role can read/write (admin-only view, no user-facing access)
alter table public.contact_leads enable row level security;

comment on table public.contact_leads is 'Leads captured via Contact Sales form on landing page and dashboard. Admin-only (service role) — no user-facing policies.';
