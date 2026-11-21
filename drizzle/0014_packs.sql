ALTER TABLE "products" ADD COLUMN "pack_size" integer;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "pack_mrp_paise" integer;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "pack_cost_paise" integer;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_pack_valid" CHECK ("products"."pack_size" IS NULL OR ("products"."pack_size" BETWEEN 2 AND 1000));--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_pack_prices_positive" CHECK (("products"."pack_mrp_paise" IS NULL OR "products"."pack_mrp_paise" > 0) AND ("products"."pack_cost_paise" IS NULL OR "products"."pack_cost_paise" >= 0));