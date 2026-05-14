# Competitor Snapshot-Delta Architecture — Investigation Findings

Status: **Build deferred.** Pre-flight surfaced schema/spec mismatches that need a
product decision before migration files can be written. Captured here so the
next session can pick up without re-discovering.

## Why velocity is wrong today

Places API returns the 5 *most-relevant* reviews, not the 5 *most-recent*.
Fixed-window math (e.g. "reviews in last 30 days") against that sample is
meaningless. Intended fix: capture `userRatingCount` snapshots over time and
compute velocity as the delta between snapshots. This investigation covered
**schema only** — no business logic, API routes, or UI.

## Migration tool / location

Raw SQL files in `supabase/migrations/`, numbered `NNNN_name.sql`. Existing
migrations run `0001` through `0008`. The next file would be `0009_*.sql`.

There is no Drizzle, Prisma, or Supabase CLI generator in use — files are
hand-authored SQL.

## Existing `competitors` table — the conventions the new tables must match

Defined in `supabase/migrations/0007_places_integration.sql` lines 24–43.

```sql
CREATE TABLE IF NOT EXISTS competitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  place_id TEXT NOT NULL,
  name TEXT NOT NULL,
  formatted_address TEXT,
  city TEXT,
  lat NUMERIC(10,7),
  lng NUMERIC(10,7),
  category TEXT,
  google_maps_uri TEXT,
  rating NUMERIC(2,1),
  total_ratings INTEGER,
  recent_reviews JSONB,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  last_synced_at TIMESTAMPTZ,
  sync_status TEXT,
  sync_error TEXT,
  UNIQUE(user_id, place_id)
);
```

Key facts:

- **Scoping is per `user_id`, not per location.** There is no `location_id`
  column on `competitors`. The task spec ("competitors per owned location")
  does not match what exists.
- **Column name is `place_id`**, not `competitor_place_id`. The task spec
  uses `competitor_place_id` throughout — that name appears nowhere in the
  current schema.
- FK pattern: `user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE`.
- Unique constraint: `(user_id, place_id)`.
- Inline comment on line 23 acknowledges the limitation:
  `-- Competitors table (scoped to user_id, will migrate to company_id in Phase 5B)`

## `company_id` status — does not exist yet

- No table in `supabase/migrations/` has a `company_id` column. Grepping
  `supabase/` returns exactly one hit: the comment on line 23 of `0007_*.sql`
  noting future migration.
- Grep across `src/` for `company_id` returns zero matches.
- `supabase/migrations/0008_company_context.sql` adds company data as a
  JSONB blob (`users.company_context`) and explicitly notes:
  `'Business profile data fueling AI Insights. Will migrate to companies table in Phase 5B.'`
- There is no `companies` table. There is no FK target for a `company_id`
  column to point at. Multi-tenancy today is `user_id`-based.

Therefore the task spec's "multi-tenancy `company_id` pattern" describes
*planned* (Phase 5B) work, not anything currently in the schema.

## Scoping options surfaced (decision needed before building)

### Ownership / tenancy scoping

1. **Match existing — `user_id` only.** Both new tables FK to `users(id)`,
   matching `competitors`. No `company_id`, no `location_id`. Closest to
   convention; zero forward-looking columns.
2. **`user_id` + nullable `location_id`.** Add a nullable FK to `locations(id)`
   so snapshots can later be associated with a specific owned location. No
   `company_id` (no table exists to FK to).
3. **Introduce `company_id` now (greenfield).** Add `company_id` with no FK
   target since no `companies` table exists. Diverges from current convention
   and creates an orphan column — flagged as risky.

### FK / identifier to the competitor

4. **`competitor_id UUID` FK to `competitors(id)`.** Proper relational FK; survives
   any future change to how place IDs are managed. Most robust option.
5. **`place_id TEXT`** to match the existing column name on `competitors`.
   No FK enforcement (it's just the Google Places ID string).
6. **`competitor_place_id TEXT`** as the spec literally says. Does not match
   any naming used elsewhere in the schema.

## Recommended path (for the deferred session)

Subject to product confirmation:

- Scope by **`user_id`** to match `competitors` (option 1). Add `location_id`
  only if there's a concrete requirement to attribute a competitor snapshot
  to a specific owned location — that requirement was not visible in the code.
- Reference the competitor by **`competitor_id` FK to `competitors(id)`**
  (option 4). Place IDs are external; a real FK is sturdier.
- Defer anything `company_id`-shaped until the Phase 5B `companies` table
  actually lands.

## What was NOT done this session

- No migration file written.
- No `npm run build` run.
- No schema deployed to Supabase.
- No changes outside this `docs/` file.
