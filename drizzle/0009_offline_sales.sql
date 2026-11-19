ALTER TABLE "products" DROP CONSTRAINT "products_stock_nonnegative";--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "offline_at" timestamp with time zone;