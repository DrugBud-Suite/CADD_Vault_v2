-- Safe removal of legacy columns from packages and package_suggestions tables
-- Run this script after confirming all data has been migrated to normalized tables

-- Step 1: Update package_suggestions_normalized_view to remove legacy columns
CREATE OR REPLACE VIEW "public"."package_suggestions_normalized_view" AS
 SELECT "ps"."id",
    "ps"."suggested_by_user_id",
    "ps"."package_name",
    "ps"."description",
    "ps"."publication_url",
    "ps"."webserver_url",
    "ps"."repo_url",
    "ps"."link_url",
    "ps"."license",
    "ps"."suggestion_reason",
    "ps"."status",
    "ps"."admin_notes",
    "ps"."created_at",
    "ps"."reviewed_at",
    "ps"."reviewed_by_admin_id",
    COALESCE(ARRAY( SELECT "t"."name"
           FROM ("public"."package_suggestion_tags" "pst"
             JOIN "public"."tags" "t" ON (("t"."id" = "pst"."tag_id")))
          WHERE ("pst"."suggestion_id" = "ps"."id")
          ORDER BY "t"."name"), ARRAY[]::"text"[]) AS "tag_names",
    "f"."name" AS "folder_name",
    "c"."name" AS "category_name"
   FROM (((("public"."package_suggestions" "ps"
     LEFT JOIN "public"."package_suggestion_folder_categories" "psfc" ON (("psfc"."suggestion_id" = "ps"."id")))
     LEFT JOIN "public"."folder_categories" "fc" ON (("fc"."id" = "psfc"."folder_category_id")))
     LEFT JOIN "public"."folders" "f" ON (("f"."id" = "fc"."folder_id")))
     LEFT JOIN "public"."categories" "c" ON (("c"."id" = "fc"."category_id")));

-- Step 2: Update get_suggestions_with_user_email function to remove legacy columns and use normalized data
CREATE OR REPLACE FUNCTION "public"."get_suggestions_with_user_email"("filter_status" "text") RETURNS TABLE("id" "uuid", "suggested_by_user_id" "uuid", "package_name" "text", "description" "text", "publication_url" "text", "webserver_url" "text", "repo_url" "text", "link_url" "text", "license" "text", "tag_names" "text"[], "folder_name" "text", "category_name" "text", "suggestion_reason" "text", "status" "text", "admin_notes" "text", "created_at" timestamp with time zone, "reviewed_at" timestamp with time zone, "reviewed_by_admin_id" "uuid", "suggester_email" "text")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        psv.id,
        psv.suggested_by_user_id,
        psv.package_name,
        psv.description,
        psv.publication_url,
        psv.webserver_url,
        psv.repo_url,
        psv.link_url,
        psv.license,
        psv.tag_names, -- Now using normalized data
        psv.folder_name, -- Now using normalized data
        psv.category_name, -- Now using normalized data
        psv.suggestion_reason,
        psv.status,
        psv.admin_notes,
        psv.created_at,
        psv.reviewed_at,
        psv.reviewed_by_admin_id,
        u.email::text AS suggester_email
    FROM
        public.package_suggestions_normalized_view psv
    LEFT JOIN
        auth.users u ON psv.suggested_by_user_id = u.id
    WHERE
        psv.status = filter_status
    ORDER BY
        psv.created_at DESC;
END;
$$;

-- Step 3: Update packages_normalized_view to remove legacy columns  
CREATE OR REPLACE VIEW "public"."packages_normalized_view" AS
 SELECT "p"."id",
    "p"."average_rating",
    "p"."citations",
    "p"."description",
    "p"."github_owner",
    "p"."github_repo",
    "p"."github_stars",
    "p"."jif",
    "p"."journal",
    "p"."last_commit",
    "p"."last_commit_ago",
    "p"."license",
    "p"."link",
    "p"."page_icon",
    "p"."primary_language",
    "p"."publication",
    "p"."ratings_count",
    "p"."ratings_sum",
    "p"."repo_link",
    "p"."webserver",
    "p"."package_name",
    "p"."last_updated",
    COALESCE(( SELECT "array_agg"("t"."name" ORDER BY "t"."name") AS "array_agg"
           FROM ("public"."package_tags" "pt"
             JOIN "public"."tags" "t" ON (("t"."id" = "pt"."tag_id")))
          WHERE ("pt"."package_id" = "p"."id")), ARRAY[]::"text"[]) AS "tag_names",
    "f"."name" AS "folder_name",
    "c"."name" AS "category_name"
   FROM (((("public"."packages" "p"
     LEFT JOIN "public"."package_folder_categories" "pfc" ON (("pfc"."package_id" = "p"."id")))
     LEFT JOIN "public"."folder_categories" "fc" ON (("fc"."id" = "pfc"."folder_category_id")))
     LEFT JOIN "public"."folders" "f" ON (("f"."id" = "fc"."folder_id")))
     LEFT JOIN "public"."categories" "c" ON (("c"."id" = "fc"."category_id")));

-- Step 4: Remove sync triggers from packages table (no longer needed after column removal)
DROP TRIGGER IF EXISTS "sync_package_folder_category_trigger" ON "public"."packages";
DROP TRIGGER IF EXISTS "sync_package_tags_trigger" ON "public"."packages";

-- Step 5: Remove sync functions (no longer needed after column removal)
DROP FUNCTION IF EXISTS "public"."sync_package_folder_category"();
DROP FUNCTION IF EXISTS "public"."sync_package_tags"();

-- Step 6: Remove legacy columns from package_suggestions table
ALTER TABLE "public"."package_suggestions" DROP COLUMN IF EXISTS "tags";
ALTER TABLE "public"."package_suggestions" DROP COLUMN IF EXISTS "folder1"; 
ALTER TABLE "public"."package_suggestions" DROP COLUMN IF EXISTS "category1";

-- Step 7: Remove legacy columns from packages table
ALTER TABLE "public"."packages" DROP COLUMN IF EXISTS "tags";
ALTER TABLE "public"."packages" DROP COLUMN IF EXISTS "folder1";
ALTER TABLE "public"."packages" DROP COLUMN IF EXISTS "category1";

-- Step 8: Verification queries (run these to confirm success)
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'package_suggestions' AND table_schema = 'public';
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'packages' AND table_schema = 'public';
-- SELECT * FROM package_suggestions_normalized_view LIMIT 1;
-- SELECT * FROM packages_normalized_view LIMIT 1;