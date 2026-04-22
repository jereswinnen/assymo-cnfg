-- Phase 5.6: unified materials.
-- One row per (tenant, slug) instead of per (tenant, category, slug).
-- `categories` becomes a text[] so a single material can serve multiple
-- slots (wall + door + roof-trim). `pricing` shape changes from a flat
-- `{ perSqm }`/`{ surcharge }`/`{}` to a per-category map, e.g.
-- `{ wall: { perSqm: 45 }, door: { surcharge: 20 } }`.

-- 1) Add the new categories column (nullable first for backfill).
ALTER TABLE "materials" ADD COLUMN "categories" text[] NOT NULL DEFAULT ARRAY[]::text[];--> statement-breakpoint

-- 2) Backfill categories from the existing `category` column.
UPDATE "materials" SET "categories" = ARRAY["category"];--> statement-breakpoint

-- 3) Transform pricing from flat `{perSqm?|surcharge?}` to per-category
--    map `{wall?:{perSqm},door?:{surcharge},...}`. Uses the existing
--    `category` column to decide the key.
UPDATE "materials"
SET "pricing" = CASE
  WHEN "category" = 'door' AND ("pricing"->>'surcharge') IS NOT NULL
    THEN jsonb_build_object('door', jsonb_build_object('surcharge', ("pricing"->>'surcharge')::numeric))
  WHEN "category" IN ('wall', 'roof-cover', 'floor') AND ("pricing"->>'perSqm') IS NOT NULL
    THEN jsonb_build_object("category", jsonb_build_object('perSqm', ("pricing"->>'perSqm')::numeric))
  ELSE '{}'::jsonb
END
WHERE "pricing" IS NOT NULL;--> statement-breakpoint

-- 4) Collapse duplicate (tenant_id, slug) rows. For each duplicate
--    group, pick the row with the most textures (non-null) as the
--    representative. Union all categories from the group. Merge pricing
--    maps. Prefer non-null textures + tileSize from any row.
--    Products reference by (slug, category); since slugs stay stable
--    and we union categories, product refs remain valid.
DO $$
DECLARE
  grp RECORD;
  repr_id TEXT;
  merged_categories TEXT[];
  merged_pricing JSONB;
  merged_textures JSONB;
  merged_tile_size JSONB;
BEGIN
  FOR grp IN
    SELECT tenant_id, slug
    FROM materials
    GROUP BY tenant_id, slug
    HAVING COUNT(*) > 1
  LOOP
    -- Representative: the first row with non-null textures, else oldest.
    SELECT id INTO repr_id
    FROM materials
    WHERE tenant_id = grp.tenant_id AND slug = grp.slug
    ORDER BY (textures IS NULL) ASC, created_at ASC
    LIMIT 1;

    -- Union categories (distinct).
    SELECT ARRAY(SELECT DISTINCT unnest(array_agg(unnest_c)) ORDER BY 1)
    INTO merged_categories
    FROM (
      SELECT unnest(categories) AS unnest_c
      FROM materials
      WHERE tenant_id = grp.tenant_id AND slug = grp.slug
    ) u;

    -- Merge pricing maps (later rows don't override earlier — all keys
    -- are distinct because each row's pricing has only its own category).
    SELECT COALESCE(jsonb_object_agg(k, v), '{}'::jsonb)
    INTO merged_pricing
    FROM (
      SELECT DISTINCT k, v
      FROM materials, LATERAL jsonb_each(pricing) AS e(k, v)
      WHERE tenant_id = grp.tenant_id AND slug = grp.slug
    ) p;

    -- Textures: prefer any non-null; pick the first in created_at order.
    SELECT textures INTO merged_textures
    FROM materials
    WHERE tenant_id = grp.tenant_id AND slug = grp.slug AND textures IS NOT NULL
    ORDER BY created_at ASC
    LIMIT 1;

    -- Tile size: prefer any non-null.
    SELECT tile_size INTO merged_tile_size
    FROM materials
    WHERE tenant_id = grp.tenant_id AND slug = grp.slug AND tile_size IS NOT NULL
    ORDER BY created_at ASC
    LIMIT 1;

    -- Update the representative row with the merged data.
    UPDATE materials
    SET
      categories = merged_categories,
      pricing = merged_pricing,
      textures = merged_textures,
      tile_size = merged_tile_size
    WHERE id = repr_id;

    -- Delete the rest.
    DELETE FROM materials
    WHERE tenant_id = grp.tenant_id AND slug = grp.slug AND id <> repr_id;
  END LOOP;
END $$;--> statement-breakpoint

-- 5) Drop the now-redundant per-category unique index and replace with
--    per-slug uniqueness.
DROP INDEX IF EXISTS "materials_tenant_category_slug_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "materials_tenant_slug_idx" ON "materials" USING btree ("tenant_id","slug");--> statement-breakpoint

-- 6) Drop the old `category` column.
ALTER TABLE "materials" DROP COLUMN "category";
