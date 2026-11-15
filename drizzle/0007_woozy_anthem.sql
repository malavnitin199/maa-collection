CREATE TABLE "approval_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" text NOT NULL,
	"sale_id" uuid,
	"exchange_id" uuid,
	"decision" text NOT NULL,
	"reason" text,
	"note" text,
	"decided_by" uuid NOT NULL,
	"auto" boolean DEFAULT false NOT NULL,
	"batch_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "approval_decisions_one_target" CHECK (("approval_decisions"."sale_id" IS NULL) <> ("approval_decisions"."exchange_id" IS NULL)),
	CONSTRAINT "approval_decisions_valid" CHECK ("approval_decisions"."decision" IN ('approved', 'rejected'))
);
--> statement-breakpoint
ALTER TABLE "sales" DROP CONSTRAINT "sales_price_le_mrp";--> statement-breakpoint
ALTER TABLE "exchanges" ALTER COLUMN "original_sale_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "sales" ALTER COLUMN "product_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "sales" ALTER COLUMN "mrp_paise" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "manual" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "manual_note" text;--> statement-breakpoint
ALTER TABLE "approval_decisions" ADD CONSTRAINT "approval_decisions_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_decisions" ADD CONSTRAINT "approval_decisions_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_decisions" ADD CONSTRAINT "approval_decisions_exchange_id_exchanges_id_fk" FOREIGN KEY ("exchange_id") REFERENCES "public"."exchanges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_decisions" ADD CONSTRAINT "approval_decisions_decided_by_staff_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "approval_decisions_sale_uq" ON "approval_decisions" USING btree ("sale_id");--> statement-breakpoint
CREATE UNIQUE INDEX "approval_decisions_exchange_uq" ON "approval_decisions" USING btree ("exchange_id");--> statement-breakpoint
CREATE INDEX "approval_decisions_store_created_idx" ON "approval_decisions" USING btree ("store_id","created_at");--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_item_or_manual" CHECK (("sales"."product_id" IS NOT NULL AND "sales"."mrp_paise" IS NOT NULL) OR "sales"."manual");--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_price_le_mrp" CHECK ("sales"."unit_price_paise" > 0 AND ("sales"."mrp_paise" IS NULL OR "sales"."unit_price_paise" <= "sales"."mrp_paise"));