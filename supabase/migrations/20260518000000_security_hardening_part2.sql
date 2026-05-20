-- Security hardening, part 2. Apply AFTER 20260517000000_security_hardening.sql.
--
-- Fixes:
--   1. SET search_path = '' on the remaining SECURITY DEFINER functions that
--      part 1 did not recreate (trigger functions + one-shot maintenance
--      functions). Closes Splinter lint 0011 for the whole schema.
--   2. Drop the redundant rating trigger so update_package_ratings() runs
--      exactly once per write instead of twice.
--   3. Add input-size validation to mutation RPCs to cap abuse vectors
--      (oversized tag arrays, overly long names) that the auth guards alone
--      do not prevent. Caps come from CADD-Vault domain norms.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. search_path hygiene on the 7 SECURITY DEFINER functions part 1 skipped.
-- ---------------------------------------------------------------------------
ALTER FUNCTION public.assign_defaults_to_unassigned_packages()       SET search_path = '';
ALTER FUNCTION public.check_package_has_folder_category()            SET search_path = '';
ALTER FUNCTION public.check_package_has_tags()                       SET search_path = '';
ALTER FUNCTION public.ensure_package_has_default_assignments(uuid)   SET search_path = '';
ALTER FUNCTION public.migrate_package_folder_categories()            SET search_path = '';
ALTER FUNCTION public.migrate_package_tags()                         SET search_path = '';
ALTER FUNCTION public.validate_all_packages_have_assignments()       SET search_path = '';

-- ---------------------------------------------------------------------------
-- 2. Drop the redundant combined trigger. Keep the 3 per-operation triggers
--    (ratings_insert/update/delete_trigger) so each event has its own named
--    trigger -- easier to reason about when debugging.
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS update_package_ratings_trigger ON public.ratings;

-- ---------------------------------------------------------------------------
-- 3. Input validation. Recreate the 5 mutation RPCs preserving every
--    security guard from part 1 and adding size caps. Limits chosen for
--    CADD-Vault: typical packages have <15 tags; longest legitimate tag
--    name observed is ~30 chars. Caps leave headroom without enabling abuse.
-- ---------------------------------------------------------------------------

-- Shared limits (kept as DO-block constants for documentation only; the
-- actual checks below use literals so the function bodies are self-contained.)
--   MAX_TAGS_PER_PACKAGE         = 50
--   MAX_TAG_NAME_LEN             = 64
--   MAX_FOLDER_OR_CATEGORY_LEN   = 256

CREATE OR REPLACE FUNCTION public.update_package_tags(
  package_uuid uuid, new_tags text[]
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  tag_name text;
  current_tag_id uuid;
BEGIN
  IF NOT public.is_current_user_admin() THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;
  IF new_tags IS NULL THEN
    new_tags := ARRAY[]::text[];
  END IF;
  IF array_length(new_tags, 1) > 50 THEN
    RAISE EXCEPTION 'too many tags (max 50, got %)', array_length(new_tags, 1)
      USING ERRCODE = '22023';
  END IF;

  DELETE FROM public.package_tags WHERE package_id = package_uuid;
  FOREACH tag_name IN ARRAY new_tags LOOP
    IF tag_name IS NOT NULL AND tag_name != '' THEN
      IF length(tag_name) > 64 THEN
        RAISE EXCEPTION 'tag name too long (max 64 chars)' USING ERRCODE = '22023';
      END IF;
      current_tag_id := public.ensure_tag_exists(tag_name);
      INSERT INTO public.package_tags (package_id, tag_id)
      VALUES (package_uuid, current_tag_id)
      ON CONFLICT (package_id, tag_id) DO NOTHING;
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_suggestion_tags(
  suggestion_uuid uuid, new_tags text[]
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  tag_name text;
  current_tag_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;
  IF NOT (
    public.is_current_user_admin()
    OR EXISTS (
      SELECT 1 FROM public.package_suggestions
      WHERE id = suggestion_uuid
        AND suggested_by_user_id = auth.uid()
        AND status = 'pending'
    )
  ) THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;
  IF new_tags IS NULL THEN
    new_tags := ARRAY[]::text[];
  END IF;
  IF array_length(new_tags, 1) > 50 THEN
    RAISE EXCEPTION 'too many tags (max 50, got %)', array_length(new_tags, 1)
      USING ERRCODE = '22023';
  END IF;

  DELETE FROM public.package_suggestion_tags WHERE suggestion_id = suggestion_uuid;
  FOREACH tag_name IN ARRAY new_tags LOOP
    IF tag_name IS NOT NULL AND tag_name != '' THEN
      IF length(tag_name) > 64 THEN
        RAISE EXCEPTION 'tag name too long (max 64 chars)' USING ERRCODE = '22023';
      END IF;
      current_tag_id := public.ensure_tag_exists(tag_name);
      INSERT INTO public.package_suggestion_tags (suggestion_id, tag_id)
      VALUES (suggestion_uuid, current_tag_id)
      ON CONFLICT (suggestion_id, tag_id) DO NOTHING;
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_package_folder_category(
  package_uuid uuid, folder_name text, category_name text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  folder_cat_id uuid;
BEGIN
  IF NOT public.is_current_user_admin() THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;
  IF folder_name IS NOT NULL AND length(folder_name) > 256 THEN
    RAISE EXCEPTION 'folder name too long (max 256 chars)' USING ERRCODE = '22023';
  END IF;
  IF category_name IS NOT NULL AND length(category_name) > 256 THEN
    RAISE EXCEPTION 'category name too long (max 256 chars)' USING ERRCODE = '22023';
  END IF;

  DELETE FROM public.package_folder_categories WHERE package_id = package_uuid;
  IF folder_name IS NOT NULL AND category_name IS NOT NULL
     AND folder_name != '' AND category_name != '' THEN
    folder_cat_id := public.ensure_folder_category_exists(folder_name, category_name);
    INSERT INTO public.package_folder_categories
      (package_id, folder_category_id)
    VALUES (package_uuid, folder_cat_id);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_suggestion_folder_category(
  suggestion_uuid uuid, folder_name text, category_name text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  folder_cat_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;
  IF NOT (
    public.is_current_user_admin()
    OR EXISTS (
      SELECT 1 FROM public.package_suggestions
      WHERE id = suggestion_uuid
        AND suggested_by_user_id = auth.uid()
        AND status = 'pending'
    )
  ) THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;
  IF folder_name IS NOT NULL AND length(folder_name) > 256 THEN
    RAISE EXCEPTION 'folder name too long (max 256 chars)' USING ERRCODE = '22023';
  END IF;
  IF category_name IS NOT NULL AND length(category_name) > 256 THEN
    RAISE EXCEPTION 'category name too long (max 256 chars)' USING ERRCODE = '22023';
  END IF;

  DELETE FROM public.package_suggestion_folder_categories
   WHERE suggestion_id = suggestion_uuid;
  IF folder_name IS NOT NULL AND category_name IS NOT NULL
     AND folder_name != '' AND category_name != '' THEN
    folder_cat_id := public.ensure_folder_category_exists(folder_name, category_name);
    INSERT INTO public.package_suggestion_folder_categories
      (suggestion_id, folder_category_id)
    VALUES (suggestion_uuid, folder_cat_id);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_folder_category_exists(
  folder_name text, category_name text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  f_id uuid;
  c_id uuid;
  folder_category_id uuid;
BEGIN
  IF NOT public.is_current_user_admin() THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;
  IF folder_name IS NULL OR folder_name = '' THEN
    RAISE EXCEPTION 'folder_name required' USING ERRCODE = '22023';
  END IF;
  IF category_name IS NULL OR category_name = '' THEN
    RAISE EXCEPTION 'category_name required' USING ERRCODE = '22023';
  END IF;
  IF length(folder_name) > 256 THEN
    RAISE EXCEPTION 'folder name too long (max 256 chars)' USING ERRCODE = '22023';
  END IF;
  IF length(category_name) > 256 THEN
    RAISE EXCEPTION 'category name too long (max 256 chars)' USING ERRCODE = '22023';
  END IF;

  SELECT id INTO f_id FROM public.folders WHERE name = folder_name;
  IF f_id IS NULL THEN
    INSERT INTO public.folders (name) VALUES (folder_name) RETURNING id INTO f_id;
  END IF;

  SELECT id INTO c_id FROM public.categories WHERE name = category_name;
  IF c_id IS NULL THEN
    INSERT INTO public.categories (name) VALUES (category_name) RETURNING id INTO c_id;
  END IF;

  SELECT id INTO folder_category_id
  FROM public.folder_categories
  WHERE folder_id = f_id AND category_id = c_id;
  IF folder_category_id IS NULL THEN
    INSERT INTO public.folder_categories (folder_id, category_id)
    VALUES (f_id, c_id) RETURNING id INTO folder_category_id;
  END IF;

  RETURN folder_category_id;
END;
$$;

-- ensure_tag_exists: add length cap (called by update_package_tags /
-- update_suggestion_tags which already cap, but defense in depth).
CREATE OR REPLACE FUNCTION public.ensure_tag_exists(tag_name text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  existing_tag_id uuid;
BEGIN
  IF tag_name IS NULL OR tag_name = '' THEN
    RAISE EXCEPTION 'tag_name required' USING ERRCODE = '22023';
  END IF;
  IF length(tag_name) > 64 THEN
    RAISE EXCEPTION 'tag name too long (max 64 chars)' USING ERRCODE = '22023';
  END IF;
  SELECT id INTO existing_tag_id FROM public.tags WHERE name = tag_name;
  IF existing_tag_id IS NULL THEN
    INSERT INTO public.tags (name) VALUES (tag_name) RETURNING id INTO existing_tag_id;
  END IF;
  RETURN existing_tag_id;
END;
$$;

COMMIT;
