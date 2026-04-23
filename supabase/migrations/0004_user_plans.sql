-- Plan column on users. Default 'free'. Enterprise clients get manually promoted by admin.
alter table public.users
  add column if not exists plan text not null default 'free'
  check (plan in ('free', 'pro', 'agency', 'enterprise'));

create index if not exists idx_users_plan on public.users(plan);

-- Helper comment for admins:
comment on column public.users.plan is 'Billing plan. free = default signup, pro = self-serve Stripe (future), agency = invoiced agency client, enterprise = invoiced enterprise client. Manually set by admin until Stripe is wired in V2.';
