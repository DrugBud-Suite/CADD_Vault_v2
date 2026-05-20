-- ===========================================================================
-- folder/category package-filtering RPC.
--
-- Replaces a 4-round-trip client-side filter (folder name -> id, category
-- name -> id, folder_categories lookup, package_folder_categories lookup)
-- with a single server-side call.
--
-- Read-only over public catalog tables; runs as SECURITY INVOKER (the default,
-- caller's privileges) since anon already holds SELECT on these tables for
-- browsing -- no elevated privileges are needed or granted.
--
-- Valid for local dev (supabase db reset) and the future live DB
-- (supabase db push). Idempotent: safe to re-run.
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.get_package_ids_for_folder_category(
  p_folder text DEFAULT NULL,
  p_category text DEFAULT NULL
) RETURNS TABLE (package_id uuid)
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT DISTINCT pfc.package_id
  FROM public.package_folder_categories pfc
  JOIN public.folder_categories fc ON fc.id = pfc.folder_category_id
  JOIN public.folders f ON f.id = fc.folder_id
  JOIN public.categories c ON c.id = fc.category_id
  WHERE (p_folder IS NULL OR f.name = p_folder)
    AND (p_category IS NULL OR c.name = p_category);
$$;

GRANT EXECUTE ON FUNCTION public.get_package_ids_for_folder_category(text, text)
  TO anon, authenticated;
