CREATE TABLE "supplier_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" text NOT NULL,
	"operation_id" text NOT NULL,
	"supplier_id" uuid NOT NULL,
	"bill_number" text,
	"amount_paise" integer NOT NULL,
	"paid_on" date NOT NULL,
	"note" text,
	"staff_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "supplier_payments_amount_positive" CHECK ("supplier_payments"."amount_paise" > 0)
);
--> statement-breakpoint
ALTER TABLE "stock_movements" ADD COLUMN "unit_cost_paise" integer;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "location" text;--> statement-breakpoint
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "supplier_payments_store_operation_uq" ON "supplier_payments" USING btree ("store_id","operation_id");--> statement-breakpoint
CREATE INDEX "supplier_payments_supplier_idx" ON "supplier_payments" USING btree ("supplier_id","paid_on");