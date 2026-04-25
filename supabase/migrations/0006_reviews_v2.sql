-- ============================================================================
-- Phase 5A.6 — Reviews v2
-- Augments cached_reviews with reply tracking, TAT computation, and reputation
-- metric views. Adds review_sync_state for incremental sync attribution.
--
-- Note: this builds on the existing 0003 schema, which uses these column names:
--   author_name, author_photo_url, text, publish_time, google_review_name
-- We KEEP those names rather than rename, so existing dashboard reads continue
-- to work. New columns below cover what GMB-API-fetched reviews need on top.
-- ============================================================================

alter table public.cached_reviews
  add column if not exists update_time           timestamptz,
  add column if not exists reply_text            text,
  add column if not exists reply_create_time     timestamptz,
  add column if not exists reply_update_time     timestamptz,
  add column if not exists replied_by_user_id    uuid references public.users(id) on delete set null,
  add column if not exists replied_by_name       text,
  add column if not exists first_response_tat_seconds bigint,
  add column if not exists has_reply             boolean not null default false,
  add column if not exists fetched_at            timestamptz default now();

create index if not exists idx_cached_reviews_has_reply
  on public.cached_reviews (has_reply, location_id);
create index if not exists idx_cached_reviews_publish_time
  on public.cached_reviews (publish_time desc, location_id);
create index if not exists idx_cached_reviews_rating
  on public.cached_reviews (rating, location_id);
create index if not exists idx_cached_reviews_user_status
  on public.cached_reviews (user_id, has_reply, publish_time desc);

-- Trigger keeps has_reply + first_response_tat_seconds in lockstep with reply_text
-- so the inbox can filter on has_reply (indexed) instead of reply_text IS NOT NULL.
create or replace function public.compute_review_reply_status()
returns trigger language plpgsql as $$
begin
  if new.reply_text is not null and length(trim(new.reply_text)) > 0 then
    new.has_reply := true;
    if new.reply_create_time is not null and new.publish_time is not null then
      new.first_response_tat_seconds := extract(epoch from (new.reply_create_time - new.publish_time))::bigint;
    end if;
  else
    new.has_reply := false;
    new.first_response_tat_seconds := null;
  end if;
  return new;
end; $$;

drop trigger if exists cached_reviews_compute_reply_status on public.cached_reviews;
create trigger cached_reviews_compute_reply_status
  before insert or update on public.cached_reviews
  for each row execute function public.compute_review_reply_status();

-- Reputation metrics view — fast TAT + response-rate roll-ups per location.
create or replace view public.reputation_metrics as
select
  user_id,
  location_id,
  count(*)                                                              as total_reviews,
  count(*) filter (where has_reply)                                     as replied_reviews,
  count(*) filter (where not has_reply)                                 as unresponded_reviews,
  case
    when count(*) > 0
      then round(100.0 * count(*) filter (where has_reply) / count(*), 1)
    else 0
  end                                                                   as response_rate_pct,
  avg(first_response_tat_seconds) filter (where has_reply)              as avg_tat_seconds,
  percentile_cont(0.5) within group (order by first_response_tat_seconds)
    filter (where has_reply)                                            as median_tat_seconds,
  min(first_response_tat_seconds) filter (where has_reply)              as min_tat_seconds,
  max(first_response_tat_seconds) filter (where has_reply)              as max_tat_seconds,
  max(publish_time)                                                     as latest_review_time,
  max(reply_create_time)                                                as latest_reply_time
from public.cached_reviews
group by user_id, location_id;

-- Daily aggregated reputation metrics — feeds trend charts.
create or replace view public.daily_reputation_metrics as
select
  user_id,
  location_id,
  date_trunc('day', publish_time)::date                             as review_date,
  count(*)                                                          as reviews_received,
  count(*) filter (where has_reply)                                 as reviews_with_reply,
  avg(first_response_tat_seconds) filter (where has_reply)          as avg_tat_seconds_for_day,
  avg(rating)::numeric(3,2)                                         as avg_rating
from public.cached_reviews
where publish_time is not null
group by user_id, location_id, date_trunc('day', publish_time)::date;

-- Per-location sync attribution. Lets the cron + UI report what happened last.
create table if not exists public.review_sync_state (
  location_id        uuid primary key references public.locations(id) on delete cascade,
  user_id            uuid not null references public.users(id) on delete cascade,
  last_synced_at     timestamptz not null default now(),
  last_review_count  integer default 0,
  last_sync_status   text not null default 'success'
                       check (last_sync_status in ('success','partial','failed','in_progress')),
  last_sync_error    text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists idx_review_sync_state_user on public.review_sync_state (user_id);

drop trigger if exists review_sync_state_touch on public.review_sync_state;
create trigger review_sync_state_touch
  before update on public.review_sync_state
  for each row execute function public.touch_updated_at();

alter table public.review_sync_state enable row level security;

drop policy if exists "review_sync_state_owner_read" on public.review_sync_state;
create policy "review_sync_state_owner_read"
  on public.review_sync_state for select
  using (auth.uid() = user_id);
-- writes go through service role only (cron + sync routes); no INSERT/UPDATE policies.

comment on table public.review_sync_state         is 'Tracks last successful review sync per location for incremental fetching.';
comment on view  public.reputation_metrics        is 'Per-location reputation metrics (TAT, response rate) computed from cached_reviews.';
comment on view  public.daily_reputation_metrics  is 'Daily aggregated reputation metrics for trend charts.';
