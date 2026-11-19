CREATE TABLE "sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" text NOT NULL,
	"name" text NOT NULL,
	"name_hi" text,
	"icon" text DEFAULT 'hanger' NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "categories_store_name_uq";--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "section_id" uuid;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "name_hi" text;--> statement-breakpoint
ALTER TABLE "stock_receipts" ADD COLUMN "stock_date" date;--> statement-breakpoint
ALTER TABLE "sections" ADD CONSTRAINT "sections_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "sections_store_name_uq" ON "sections" USING btree ("store_id","name");--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_section_id_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."sections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "categories_store_section_name_uq" ON "categories" USING btree ("store_id","section_id","name");