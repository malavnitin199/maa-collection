ALTER TABLE "stores" ADD COLUMN "price_code_word" text;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "print_price_code" boolean DEFAULT false NOT NULL;