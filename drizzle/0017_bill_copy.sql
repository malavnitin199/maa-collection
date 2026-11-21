ALTER TABLE "bill_collections" ADD COLUMN "snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "bill_companies" ADD COLUMN "company_name" text DEFAULT '' NOT NULL;--> statement-breakpoint
UPDATE "bill_companies" SET "company_name" = "suppliers"."name" FROM "suppliers" WHERE "suppliers"."id" = "bill_companies"."supplier_id";
