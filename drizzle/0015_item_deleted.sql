ALTER TABLE "sales" DROP CONSTRAINT "sales_item_or_manual";--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "item_deleted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_item_or_manual" CHECK (("sales"."product_id" IS NOT NULL AND "sales"."mrp_paise" IS NOT NULL) OR "sales"."manual" OR "sales"."item_deleted");