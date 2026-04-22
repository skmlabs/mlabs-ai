-- Cache table for fetched GMB performance metrics (by location by day)
create table if not exists public.daily_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  metric_date date not null,
  calls integer default 0,
  direction_requests integer default 0,
  website_clicks integer default 0,
  business_impressions_desktop_maps integer default 0,
  business_impressions_desktop_search integer default 0,
  business_impressions_mobile_maps integer default 0,
  business_impressions_mobile_search integer default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (location_id, metric_date)
);

alter table public.daily_metrics enable row level security;

create policy "users read own daily_metrics" on public.daily_metrics
  for select using (auth.uid() = user_id);
-- Writes by service role only.

create index if not exists idx_daily_metrics_user_date on public.daily_metrics(user_id, metric_date desc);
create index if not exists idx_daily_metrics_location_date on public.daily_metrics(location_id, metric_date desc);

-- Cached reviews
create table if not exists public.cached_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  place_id text not null,
  google_review_name text not null,
  author_name text,
  author_photo_url text,
  rating integer,
  text text,
  publish_time timestamptz,
  created_at timestamptz not null default now(),
  unique (location_id, google_review_name)
);

alter table public.cached_reviews enable row level security;

create policy "users read own cached_reviews" on public.cached_reviews
  for select using (auth.uid() = user_id);

create index if not exists idx_cached_reviews_location on public.cached_reviews(location_id, publish_time desc nulls last);

-- Aggregated review stats per location (fast reads for KPIs)
create table if not exists public.location_review_stats (
  location_id uuid primary key references public.locations(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  average_rating numeric(3,2),
  total_reviews integer default 0,
  last_fetched_at timestamptz
);

alter table public.location_review_stats enable row level security;

create policy "users read own review_stats" on public.location_review_stats
  for select using (auth.uid() = user_id);

-- Fetch state: when did we last hit GMB Perf API for this location? used for caching + "pending access" awareness
create table if not exists public.metric_fetch_state (
  location_id uuid primary key references public.locations(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  last_fetched_at timestamptz,
  last_status text not null default 'never' check (last_status in ('never','ok','pending_api_access','error')),
  last_error text
);

alter table public.metric_fetch_state enable row level security;

create policy "users read own fetch_state" on public.metric_fetch_state
  for select using (auth.uid() = user_id);
