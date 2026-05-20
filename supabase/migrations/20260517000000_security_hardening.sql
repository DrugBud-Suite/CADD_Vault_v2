-- Security hardening migration for CADD Vault.
-- Apply AFTER schema.sql + data.sql on restore.
--
-- Fixes:
--   1. Revoke blanket EXECUTE-to-anon on every SECURITY DEFINER function.
--   2. Re-grant only the functions each role actually needs.
--   3. Add server-side auth guards inside each SECURITY DEFINER function.
--   4. Drop+recreate approve_suggestion_with_normalized_data:
--        - remove the spoofable approved_by parameter (derive from auth.uid())
--        - fix the parameter/column name shadowing bug that copied ALL
--          suggestion tags + folder_categories to the new package
--   5. Add the missing INSERT policy on package_suggestions so logged-in
--      users can actually submit suggestions (the original schema only had
--      admin/select-own/update-own/delete-own — submission was broken).
--   6. SET search_path = '' on every SECURITY DEFINER function to close
--      the Splinter lint 0011 (function_search_path_mutable) attack path.
--   7. Add TO clauses to policies that omitted them (cleanliness, not a
--      vulnerability — the inner USING check already enforced the role).

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Tear down the over-permissive default privileges.
-- ---------------------------------------------------------------------------
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON FUNCTIONS FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON FUNCTIONS FROM authenticated;

-- Revoke EXECUTE from every existing public-schema function for anon and
-- authenticated. We grant back the allowed set explicitly below.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname AS schema_name, p.proname AS func_name,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
  LOOP
    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM anon, authenticated',
      r.schema_name, r.func_name, r.args
    );
  END LOOP;
END$$;

-- ---------------------------------------------------------------------------
-- 2. Recreate every SECURITY DEFINER function with:
--      - SET search_path = ''
--      - explicit role guard inside the body
--      - fully-qualified object names
-- ---------------------------------------------------------------------------

-- ratings: authenticated only, self-scoping via auth.uid()
CREATE OR REPLACE FUNCTION public.upsert_rating(
  package_uuid uuid, new_rating integer
) RETURNS TABLE(average_rating numeric, ratings_count bigint, user_rating integer, rating_id text)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  existing_rating_id uuid;
  new_rating_id uuid;
  current_user_id uuid;
BEGIN
  current_user_id := auth.uid();
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;
  IF new_rating < 1 OR new_rating > 5 THEN
    RAISE EXCEPTION 'rating must be between 1 and 5' USING ERRCODE = '22023';
  END IF;

  SELECT r.id INTO existing_rating_id
  FROM public.ratings r
  WHERE r.package_id = package_uuid AND r.user_id = current_user_id;

  IF existing_rating_id IS NOT NULL THEN
    UPDATE public.ratings
       SET rating = new_rating, created_at = NOW()
     WHERE id = existing_rating_id;
    new_rating_id := existing_rating_id;
  ELSE
    INSERT INTO public.ratings (package_id, user_id, rating)
    VALUES (package_uuid, current_user_id, new_rating)
    RETURNING id INTO new_rating_id;
  END IF;

  RETURN QUERY
  SELECT
    p.average_rating::numeric,
    p.ratings_count,
    new_rating,
    new_rating_id::text
  FROM public.packages p
  WHERE p.id = package_uuid;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_user_rating(package_uuid uuid)
RETURNS TABLE(average_rating numeric, ratings_count bigint)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id uuid;
BEGIN
  current_user_id := auth.uid();
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.ratings
   WHERE package_id = package_uuid AND user_id = current_user_id;

  RETURN QUERY
  SELECT p.average_rating::numeric, p.ratings_count
  FROM public.packages p
  WHERE p.id = package_uuid;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_rating(package_uuid uuid)
RETURNS TABLE(rating integer, rating_id text)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;
  RETURN QUERY
  SELECT r.rating::integer, r.id::text
  FROM public.ratings r
  WHERE r.package_id = package_uuid AND r.user_id = auth.uid();
END;
$$;

-- public read aggregates (anon-safe, but still lock search_path)
CREATE OR REPLACE FUNCTION public.get_package_rating_stats(package_uuid uuid)
RETURNS TABLE(average_rating numeric, ratings_count bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT ROUND(AVG(r.rating)::numeric, 1), COUNT(r.rating)
  FROM public.ratings r
  WHERE r.package_id = package_uuid;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_package_tags(package_uuid uuid)
RETURNS text[]
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN ARRAY(
    SELECT t.name
    FROM public.package_tags pt
    JOIN public.tags t ON t.id = pt.tag_id
    WHERE pt.package_id = package_uuid
    ORDER BY t.name
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.admins WHERE user_id = auth.uid()
  );
END;
$$;

-- suggestion mutations: owner-of-pending OR admin
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

  DELETE FROM public.package_suggestion_tags WHERE suggestion_id = suggestion_uuid;
  FOREACH tag_name IN ARRAY new_tags LOOP
    IF tag_name IS NOT NULL AND tag_name != '' THEN
      current_tag_id := public.ensure_tag_exists(tag_name);
      INSERT INTO public.package_suggestion_tags (suggestion_id, tag_id)
      VALUES (suggestion_uuid, current_tag_id)
      ON CONFLICT (suggestion_id, tag_id) DO NOTHING;
    END IF;
  END LOOP;
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

-- package mutations + folder/category/tag creation: admin only
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

  DELETE FROM public.package_tags WHERE package_id = package_uuid;
  FOREACH tag_name IN ARRAY new_tags LOOP
    IF tag_name IS NOT NULL AND tag_name != '' THEN
      current_tag_id := public.ensure_tag_exists(tag_name);
      INSERT INTO public.package_tags (package_id, tag_id)
      VALUES (package_uuid, current_tag_id)
      ON CONFLICT (package_id, tag_id) DO NOTHING;
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

-- ensure_tag_exists is only called internally by other SECURITY DEFINER
-- functions (update_package_tags / update_suggestion_tags). No frontend
-- caller — keep it callable from postgres role, deny everyone else.
CREATE OR REPLACE FUNCTION public.ensure_tag_exists(tag_name text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  existing_tag_id uuid;
BEGIN
  -- No auth check: this is callable only by other SECURITY DEFINER funcs
  -- which already gate on caller's role. PostgREST cannot reach it because
  -- we don't GRANT EXECUTE to anon/authenticated.
  SELECT id INTO existing_tag_id FROM public.tags WHERE name = tag_name;
  IF existing_tag_id IS NULL THEN
    INSERT INTO public.tags (name) VALUES (tag_name) RETURNING id INTO existing_tag_id;
  END IF;
  RETURN existing_tag_id;
END;
$$;

-- cleanup_orphaned_tags: maintenance task, service_role/postgres only
CREATE OR REPLACE FUNCTION public.cleanup_orphaned_tags()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_current_user_admin() THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.tags t
  WHERE NOT EXISTS (
    SELECT 1 FROM public.package_tags pt WHERE pt.tag_id = t.id
  );
END;
$$;

-- admin-only: exposes auth.users.email — must require admin
CREATE OR REPLACE FUNCTION public.get_suggestions_with_user_email(filter_status text)
RETURNS TABLE(
  id uuid, suggested_by_user_id uuid, package_name text, description text,
  publication_url text, webserver_url text, repo_url text, link_url text,
  license text, tag_names text[], folder_name text, category_name text,
  suggestion_reason text, status text, admin_notes text,
  created_at timestamp with time zone, reviewed_at timestamp with time zone,
  reviewed_by_admin_id uuid, suggester_email text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_current_user_admin() THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    psv.id, psv.suggested_by_user_id, psv.package_name, psv.description,
    psv.publication_url, psv.webserver_url, psv.repo_url, psv.link_url,
    psv.license, psv.tag_names, psv.folder_name, psv.category_name,
    psv.suggestion_reason, psv.status, psv.admin_notes, psv.created_at,
    psv.reviewed_at, psv.reviewed_by_admin_id,
    u.email::text AS suggester_email
  FROM public.package_suggestions_normalized_view psv
  LEFT JOIN auth.users u ON psv.suggested_by_user_id = u.id
  WHERE psv.status = filter_status
  ORDER BY psv.created_at DESC;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. Replace approve_suggestion_with_normalized_data:
--      - drop the spoofable approved_by parameter
--      - use auth.uid() for audit attribution
--      - fix parameter/column shadowing that copied every suggestion's
--        tags+folders to the new package
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.approve_suggestion_with_normalized_data(uuid, uuid);

CREATE OR REPLACE FUNCTION public.approve_suggestion_with_normalized_data(
  p_suggestion_id uuid
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  new_package_id uuid;
  suggestion_record RECORD;
  tag_record RECORD;
  folder_cat_record RECORD;
  reviewer_id uuid;
BEGIN
  reviewer_id := auth.uid();
  IF NOT public.is_current_user_admin() THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO suggestion_record
  FROM public.package_suggestions
  WHERE id = p_suggestion_id;

  IF suggestion_record IS NULL THEN
    RAISE EXCEPTION 'suggestion not found' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.packages (
    id, package_name, description, publication, webserver,
    repo_link, link, license
  ) VALUES (
    gen_random_uuid(),
    suggestion_record.package_name,
    suggestion_record.description,
    suggestion_record.publication_url,
    suggestion_record.webserver_url,
    suggestion_record.repo_url,
    suggestion_record.link_url,
    suggestion_record.license
  )
  RETURNING id INTO new_package_id;

  -- Copy tags (FIXED: was column = column due to param shadowing)
  FOR tag_record IN
    SELECT tag_id FROM public.package_suggestion_tags
    WHERE suggestion_id = p_suggestion_id
  LOOP
    INSERT INTO public.package_tags (package_id, tag_id)
    VALUES (new_package_id, tag_record.tag_id)
    ON CONFLICT (package_id, tag_id) DO NOTHING;
  END LOOP;

  -- Copy folder/category (FIXED: same shadowing bug)
  FOR folder_cat_record IN
    SELECT folder_category_id FROM public.package_suggestion_folder_categories
    WHERE suggestion_id = p_suggestion_id
  LOOP
    INSERT INTO public.package_folder_categories (package_id, folder_category_id)
    VALUES (new_package_id, folder_cat_record.folder_category_id)
    ON CONFLICT (package_id, folder_category_id) DO NOTHING;
  END LOOP;

  UPDATE public.package_suggestions
     SET status = 'added',
         reviewed_at = NOW(),
         reviewed_by_admin_id = reviewer_id
   WHERE id = p_suggestion_id;

  RETURN new_package_id;
END;
$$;

-- Lock down ownership and search_path on the trigger-only definer function
ALTER FUNCTION public.update_package_ratings() SET search_path = '';

-- ---------------------------------------------------------------------------
-- 4. Grant EXECUTE per the access matrix.
-- ---------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION
  public.is_current_user_admin(),
  public.get_package_rating_stats(uuid),
  public.get_package_tags(uuid)
TO anon;

GRANT EXECUTE ON FUNCTION
  public.is_current_user_admin(),
  public.get_package_rating_stats(uuid),
  public.get_package_tags(uuid),
  public.get_user_rating(uuid),
  public.upsert_rating(uuid, integer),
  public.delete_user_rating(uuid),
  public.update_suggestion_tags(uuid, text[]),
  public.update_suggestion_folder_category(uuid, text, text),
  public.update_package_tags(uuid, text[]),
  public.update_package_folder_category(uuid, text, text),
  public.approve_suggestion_with_normalized_data(uuid),
  public.ensure_folder_category_exists(text, text),
  public.get_suggestions_with_user_email(text),
  public.cleanup_orphaned_tags()
TO authenticated;

-- get_packages_with_all_tags exists in the runtime DB (called from
-- packages.ts:112) but isn't in schema.sql. Grant if present.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'get_packages_with_all_tags'
  ) THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.get_packages_with_all_tags TO anon, authenticated';
  END IF;
END$$;

-- ---------------------------------------------------------------------------
-- 5. Add the missing INSERT policy for package_suggestions.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can submit suggestions"
  ON public.package_suggestions;

CREATE POLICY "Authenticated users can submit suggestions"
  ON public.package_suggestions
  FOR INSERT TO authenticated
  WITH CHECK (
    suggested_by_user_id = auth.uid()
    AND status = 'pending'
  );

-- ---------------------------------------------------------------------------
-- 6. Add TO clauses to policies that omitted them. Drop+recreate to add the
--    TO clause (Postgres < 15 has no ALTER POLICY … TO). Behaviour is
--    unchanged; this is hygiene per Supabase RLS performance guide.
-- ---------------------------------------------------------------------------

-- categories
DROP POLICY IF EXISTS "Categories are viewable by everyone" ON public.categories;
CREATE POLICY "Categories are viewable by everyone"
  ON public.categories FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Only admins can manage categories" ON public.categories;
CREATE POLICY "Only admins can manage categories"
  ON public.categories FOR ALL TO authenticated
  USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());

-- folders
DROP POLICY IF EXISTS "Folders are viewable by everyone" ON public.folders;
CREATE POLICY "Folders are viewable by everyone"
  ON public.folders FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Only admins can manage folders" ON public.folders;
CREATE POLICY "Only admins can manage folders"
  ON public.folders FOR ALL TO authenticated
  USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());

-- tags
DROP POLICY IF EXISTS "Tags are viewable by everyone" ON public.tags;
CREATE POLICY "Tags are viewable by everyone"
  ON public.tags FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Only admins can manage tags" ON public.tags;
CREATE POLICY "Only admins can manage tags"
  ON public.tags FOR ALL TO authenticated
  USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());

-- folder_categories
DROP POLICY IF EXISTS "Folder categories are viewable by everyone" ON public.folder_categories;
CREATE POLICY "Folder categories are viewable by everyone"
  ON public.folder_categories FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Only admins can manage folder categories" ON public.folder_categories;
CREATE POLICY "Only admins can manage folder categories"
  ON public.folder_categories FOR ALL TO authenticated
  USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());

-- package_tags, package_folder_categories, package_suggestion_tags, package_suggestion_folder_categories
DROP POLICY IF EXISTS "Package tags are viewable by everyone" ON public.package_tags;
CREATE POLICY "Package tags are viewable by everyone"
  ON public.package_tags FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Only admins can manage package tags" ON public.package_tags;
CREATE POLICY "Only admins can manage package tags"
  ON public.package_tags FOR ALL TO authenticated
  USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS "Package folder categories are viewable by everyone" ON public.package_folder_categories;
CREATE POLICY "Package folder categories are viewable by everyone"
  ON public.package_folder_categories FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Only admins can manage package folder categories" ON public.package_folder_categories;
CREATE POLICY "Only admins can manage package folder categories"
  ON public.package_folder_categories FOR ALL TO authenticated
  USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS "Package suggestion tags are viewable by everyone" ON public.package_suggestion_tags;
CREATE POLICY "Package suggestion tags are viewable by everyone"
  ON public.package_suggestion_tags FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Only admins can manage package suggestion tags" ON public.package_suggestion_tags;
CREATE POLICY "Only admins can manage package suggestion tags"
  ON public.package_suggestion_tags FOR ALL TO authenticated
  USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS "Package suggestion folder categories are viewable by everyone" ON public.package_suggestion_folder_categories;
CREATE POLICY "Package suggestion folder categories are viewable by everyone"
  ON public.package_suggestion_folder_categories FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Only admins can manage package suggestion folder categories" ON public.package_suggestion_folder_categories;
CREATE POLICY "Only admins can manage package suggestion folder categories"
  ON public.package_suggestion_folder_categories FOR ALL TO authenticated
  USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());

-- ratings DELETE policy had no TO clause; recreate scoped to authenticated
DROP POLICY IF EXISTS "Users can delete their own ratings" ON public.ratings;
-- (the auth-scoped one "Authenticated users can delete their own ratings"
--  already exists at schema.sql:1410 with proper TO authenticated, so we
--  just drop the redundant unscoped duplicate.)

-- admins service_role policy: add TO clause for clarity
DROP POLICY IF EXISTS "Allow full access to service_role for admins table" ON public.admins;
CREATE POLICY "Allow full access to service_role for admins table"
  ON public.admins FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 7. Restrict table-level grants to anon. schema.sql gives anon GRANT ALL on
--    all tables; RLS protects rows but the grant footprint is still wider
--    than needed. Trim to SELECT-only for anon on public-read tables.
-- ---------------------------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format(
      'REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.%I FROM anon',
      r.tablename
    );
  END LOOP;
END$$;

-- authenticated keeps INSERT/UPDATE/DELETE because RLS policies still gate it
-- at the row level, and several flows (ratings, suggestion submission) need
-- direct table access from the client.

COMMIT;
