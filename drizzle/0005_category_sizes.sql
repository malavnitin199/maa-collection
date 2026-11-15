ALTER TABLE "categories" ADD COLUMN "sizes" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
-- Starting size lists (owner can edit them in Categories). Same values as DEFAULT_CATEGORY_SIZES in src/lib/size-lists.ts. Only fills empty lists.
UPDATE "categories" SET "sizes" = ARRAY['S','M','L','XL','XXL'] WHERE "code" IN ('TS','SH','DR','NS') AND "sizes" = '{}'::text[];--> statement-breakpoint
UPDATE "categories" SET "sizes" = ARRAY['M','L','XL','XXL'] WHERE "code" IN ('KU','KR') AND "sizes" = '{}'::text[];--> statement-breakpoint
UPDATE "categories" SET "sizes" = ARRAY['26','28','30','32','34','36'] WHERE "code" = 'JE' AND "sizes" = '{}'::text[];--> statement-breakpoint
UPDATE "categories" SET "sizes" = ARRAY['Free'] WHERE "code" IN ('SA','DU') AND "sizes" = '{}'::text[];--> statement-breakpoint
-- Jeans by gender (owner decision): two categories. Skipped if a category with that name or code exists.
INSERT INTO "categories" ("store_id", "name", "code", "sizes") SELECT "id", 'Ladies Jeans', 'LJ', ARRAY['26','28','30','32'] FROM "stores" ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO "categories" ("store_id", "name", "code", "sizes") SELECT "id", 'Gents Jeans', 'GJ', ARRAY['28','30','32','34','36'] FROM "stores" ON CONFLICT DO NOTHING;
