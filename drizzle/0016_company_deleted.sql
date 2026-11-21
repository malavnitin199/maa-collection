DROP INDEX "suppliers_store_name_uq";--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "suppliers_store_name_uq" ON "suppliers" USING btree ("store_id","name") WHERE "suppliers"."deleted_at" IS NULL;