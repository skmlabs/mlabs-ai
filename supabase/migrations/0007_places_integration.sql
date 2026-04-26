-- ============================================================================
-- Phase 5B Session 1 — Places API (New) integration
-- Adds Places-sourced columns to locations (interim path while GMB API approval
-- propagates), plus competitors and a shared cached_places dedup table.
--
-- Note: locations.place_id already exists from migration 0001; the IF NOT EXISTS
-- on the ADD COLUMN below is a no-op for that column (kept verbatim per spec).
-- ============================================================================

ALTER TABLE locations
  ADD COLUMN IF NOT EXISTS place_id TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS places_rating NUMERIC(2,1),
  ADD COLUMN IF NOT EXISTS places_total_ratings INTEGER,
  ADD COLUMN IF NOT EXISTS places_recent_reviews JSONB,
  ADD COLUMN IF NOT EXISTS places_last_synced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS places_sync_status TEXT,
  ADD COLUMN IF NOT EXISTS places_sync_error TEXT;

CREATE INDEX IF NOT EXISTS idx_locations_place_id ON locations(place_id);
CREATE INDEX IF NOT EXISTS idx_locations_city ON locations(city);

-- Competitors table (scoped to user_id, will migrate to company_id in Phase 5B)
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

CREATE INDEX IF NOT EXISTS idx_competitors_user_id ON competitors(user_id);
CREATE INDEX IF NOT EXISTS idx_competitors_city ON competitors(city);

-- Shared Places API response cache (deduplication across users)
CREATE TABLE IF NOT EXISTS cached_places (
  place_id TEXT PRIMARY KEY,
  raw_response JSONB NOT NULL,
  fetched_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cached_places_fetched_at ON cached_places(fetched_at);

-- RLS policies
ALTER TABLE competitors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own competitors"
  ON competitors FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own competitors"
  ON competitors FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own competitors"
  ON competitors FOR DELETE
  USING (user_id = auth.uid());

-- cached_places is server-side only (service role); enable RLS without policies
-- so anon/authed clients are blocked by default while service role bypasses.
ALTER TABLE cached_places ENABLE ROW LEVEL SECURITY;
