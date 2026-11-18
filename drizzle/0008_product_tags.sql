ALTER TABLE "products" ADD COLUMN "for_gender" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "age_group" text;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_for_gender_valid" CHECK ("products"."for_gender" IS NULL OR "products"."for_gender" IN ('girls', 'boys', 'both'));--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_age_group_valid" CHECK ("products"."age_group" IS NULL OR "products"."age_group" IN ('adult', 'child'));