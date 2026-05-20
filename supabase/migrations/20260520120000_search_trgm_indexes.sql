-- ===========================================================================
-- Trigram (pg_trgm) GIN indexes for package text search.
--
-- The catalog search runs `package_name ILIKE '%term%'` and
-- `description ILIKE '%term%'`. A leading-wildcard ILIKE cannot use a B-tree
-- index, so it sequential-scans the entire packages table on every search.
-- GIN trigram indexes turn those scans into index lookups.
--
-- Idempotent (CREATE ... IF NOT EXISTS). Valid for local dev
-- (supabase db reset) and the future live DB (supabase db push).
-- ===========================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

CREATE INDEX IF NOT EXISTS idx_packages_package_name_trgm
  ON public.packages USING gin (package_name extensions.gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_packages_description_trgm
  ON public.packages USING gin (description extensions.gin_trgm_ops);
