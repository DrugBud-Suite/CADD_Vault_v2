-- ===========================================================================
-- Security hardening, part 3: package_suggestions input validation +
-- audit-trail integrity.
--
-- This migration:
--   1. Adds length CHECK constraints to package_suggestions text columns so
--      authenticated users cannot submit unbounded (multi-megabyte) strings.
--   2. Hardens the admin RLS policy so reviewed_by_admin_id can only be set
--      to the acting admin's own uid() -- prevents audit-log spoofing where
--      an admin attributes a review to another user's UUID.
--
-- Valid for local dev (supabase db reset) and the future live DB
-- (supabase db push). Idempotent: safe to re-run.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Length constraints on package_suggestions text columns.
--    Limits are generous upper bounds intended to stop abuse / DoS, not to
--    model precise business rules. Adjust the numbers freely.
-- ---------------------------------------------------------------------------
ALTER TABLE public.package_suggestions
  DROP CONSTRAINT IF EXISTS chk_package_name_length,
  DROP CONSTRAINT IF EXISTS chk_description_length,
  DROP CONSTRAINT IF EXISTS chk_suggestion_reason_length,
  DROP CONSTRAINT IF EXISTS chk_admin_notes_length,
  DROP CONSTRAINT IF EXISTS chk_license_length,
  DROP CONSTRAINT IF EXISTS chk_publication_url_length,
  DROP CONSTRAINT IF EXISTS chk_webserver_url_length,
  DROP CONSTRAINT IF EXISTS chk_repo_url_length,
  DROP CONSTRAINT IF EXISTS chk_link_url_length;

ALTER TABLE public.package_suggestions
  ADD CONSTRAINT chk_package_name_length
    CHECK (char_length(package_name) BETWEEN 1 AND 200),
  ADD CONSTRAINT chk_description_length
    CHECK (description IS NULL OR char_length(description) <= 5000),
  ADD CONSTRAINT chk_suggestion_reason_length
    CHECK (suggestion_reason IS NULL OR char_length(suggestion_reason) <= 2000),
  ADD CONSTRAINT chk_admin_notes_length
    CHECK (admin_notes IS NULL OR char_length(admin_notes) <= 2000),
  ADD CONSTRAINT chk_license_length
    CHECK (license IS NULL OR char_length(license) <= 100),
  ADD CONSTRAINT chk_publication_url_length
    CHECK (publication_url IS NULL OR char_length(publication_url) <= 2048),
  ADD CONSTRAINT chk_webserver_url_length
    CHECK (webserver_url IS NULL OR char_length(webserver_url) <= 2048),
  ADD CONSTRAINT chk_repo_url_length
    CHECK (repo_url IS NULL OR char_length(repo_url) <= 2048),
  ADD CONSTRAINT chk_link_url_length
    CHECK (link_url IS NULL OR char_length(link_url) <= 2048);

-- ---------------------------------------------------------------------------
-- 2. Harden the admin RLS policy: reviewed_by_admin_id may only be NULL or
--    the acting admin's own uid(). The previous policy let an admin write
--    any UUID into the audit column.
--
--    NULL is still permitted so an admin can edit a *pending* suggestion's
--    fields (via EditSuggestionModal) without being forced to claim review
--    attribution on a not-yet-reviewed row.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins have full access to package_suggestions"
  ON public.package_suggestions;

CREATE POLICY "Admins have full access to package_suggestions"
  ON public.package_suggestions
  TO authenticated
  USING ( (SELECT public.is_current_user_admin()) )
  WITH CHECK (
    (SELECT public.is_current_user_admin())
    AND (
      reviewed_by_admin_id IS NULL
      OR reviewed_by_admin_id = (SELECT auth.uid())
    )
  );
