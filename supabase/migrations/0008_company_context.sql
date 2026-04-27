-- ============================================================================
-- Phase 5B (interim) — Company context as JSONB on users.
-- Stored on users for speed today; migrates to a proper companies table in
-- Phase 5B's multi-tenant work. Fuels AI Insights generation.
-- ============================================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS company_context JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN users.company_context IS
  'Business profile data fueling AI Insights. Will migrate to companies table in Phase 5B.';
