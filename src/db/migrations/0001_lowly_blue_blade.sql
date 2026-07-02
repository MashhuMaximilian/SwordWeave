ALTER TYPE "public"."primitive_category" ADD VALUE 'TARGETING' BEFORE 'RANGE';--> statement-breakpoint
ALTER TYPE "public"."primitive_category" ADD VALUE 'OUTPUT' BEFORE 'SHEET_AUGMENT';--> statement-breakpoint
ALTER TYPE "public"."primitive_category" ADD VALUE 'CONDITION' BEFORE 'SHEET_AUGMENT';--> statement-breakpoint
ALTER TYPE "public"."primitive_category" ADD VALUE 'DEFENSE' BEFORE 'SHEET_AUGMENT';--> statement-breakpoint
ALTER TYPE "public"."primitive_category" ADD VALUE 'STRUCTURAL' BEFORE 'SHEET_AUGMENT';--> statement-breakpoint
ALTER TABLE "primitives" ADD COLUMN "cost_tier" text DEFAULT 'Tier 1: Minor (1-2 BU)' NOT NULL;--> statement-breakpoint
ALTER TABLE "primitives" ADD COLUMN "mechanical_output_text" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "primitives" ADD COLUMN "narrative_rule" text DEFAULT '' NOT NULL;