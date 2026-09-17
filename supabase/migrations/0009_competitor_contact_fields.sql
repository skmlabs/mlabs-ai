-- ============================================================================
-- Competitor contact fields
-- Adds phone + website to competitors so the Competitors table can show
-- contact details alongside rating/review data.
--
-- Source: Places API (New) Place Details — nationalPhoneNumber / websiteUri.
-- These are fetched once when a competitor is added and refreshed by the
-- weekly places-sync-competitors cron, NOT on every autocomplete search
-- (search stays on the cheaper field mask).
--
-- Social handles are deliberately absent: Google's Places and Business
-- Profile APIs do not expose them for third-party businesses.
-- ============================================================================

ALTER TABLE competitors
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS website TEXT;
