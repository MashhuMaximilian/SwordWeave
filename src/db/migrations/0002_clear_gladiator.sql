ALTER TABLE "primitives" ADD COLUMN "is_mirrorable" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "primitives" ADD COLUMN "mirror_vector" text DEFAULT 'STANDARD_ONLY' NOT NULL;--> statement-breakpoint
ALTER TABLE "primitives" ADD COLUMN "mirror_bu_credit" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "primitives" ADD COLUMN "mirror_eligibility_notes" text DEFAULT '' NOT NULL;