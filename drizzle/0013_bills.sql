CREATE TABLE "bill_collections" (
	"bill_id" uuid NOT NULL,
	"receipt_id" uuid NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bill_companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bill_id" uuid NOT NULL,
	"supplier_id" uuid NOT NULL,
	"amount_paise" integer NOT NULL,
	CONSTRAINT "bill_companies_amount_nonnegative" CHECK ("bill_companies"."amount_paise" >= 0)
);
--> statement-breakpoint
CREATE TABLE "bills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" text NOT NULL,
	"operation_id" text NOT NULL,
	"bill_number" text,
	"bill_date" date NOT NULL,
	"note" text,
	"staff_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "supplier_payments" ADD COLUMN "bill_id" uuid;--> statement-breakpoint
ALTER TABLE "bill_collections" ADD CONSTRAINT "bill_collections_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_collections" ADD CONSTRAINT "bill_collections_receipt_id_stock_receipts_id_fk" FOREIGN KEY ("receipt_id") REFERENCES "public"."stock_receipts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_companies" ADD CONSTRAINT "bill_companies_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_companies" ADD CONSTRAINT "bill_companies_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bill_collections_receipt_uq" ON "bill_collections" USING btree ("receipt_id");--> statement-breakpoint
CREATE INDEX "bill_collections_bill_idx" ON "bill_collections" USING btree ("bill_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bill_companies_bill_supplier_uq" ON "bill_companies" USING btree ("bill_id","supplier_id");--> statement-breakpoint
CREATE INDEX "bill_companies_supplier_idx" ON "bill_companies" USING btree ("supplier_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bills_store_operation_uq" ON "bills" USING btree ("store_id","operation_id");--> statement-breakpoint
CREATE INDEX "bills_store_date_idx" ON "bills" USING btree ("store_id","bill_date");--> statement-breakpoint
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE no action ON UPDATE no action;