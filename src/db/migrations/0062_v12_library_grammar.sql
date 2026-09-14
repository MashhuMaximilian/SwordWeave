DO $$ BEGIN
  CREATE TYPE "primitive_definition_kind" AS ENUM ('TEMPLATE', 'EXPRESSION');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "primitive_classification_source" AS ENUM ('CATALOG', 'BINDING', 'INHERITED', 'MODIFIER', 'LEGACY', 'REVIEW');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "primitive_classification_status" AS ENUM ('CLASSIFIED', 'NEEDS_REVIEW');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
ALTER TABLE "primitives" ADD COLUMN IF NOT EXISTS "definition_kind" "primitive_definition_kind" NOT NULL DEFAULT 'EXPRESSION';
--> statement-breakpoint
ALTER TABLE "primitives" ADD COLUMN IF NOT EXISTS "template_primitive_id" integer;
--> statement-breakpoint
ALTER TABLE "primitives" ADD COLUMN IF NOT EXISTS "binding_schema" jsonb NOT NULL DEFAULT '{}'::jsonb;
--> statement-breakpoint
ALTER TABLE "primitives" ADD COLUMN IF NOT EXISTS "bindings" jsonb NOT NULL DEFAULT '{}'::jsonb;
--> statement-breakpoint
ALTER TABLE "primitives" ADD COLUMN IF NOT EXISTS "mechanical_rule" jsonb NOT NULL DEFAULT '{}'::jsonb;
--> statement-breakpoint
ALTER TABLE "primitives" ADD COLUMN IF NOT EXISTS "mechanical_template_text" text NOT NULL DEFAULT '';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "primitives_definition_kind_idx" ON "primitives" ("definition_kind");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "primitives_template_id_idx" ON "primitives" ("template_primitive_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lexicon_families" (
  "key" text PRIMARY KEY NOT NULL,
  "label" text NOT NULL,
  "chapter" text NOT NULL,
  "chapter_order" integer NOT NULL,
  "family_order" integer NOT NULL,
  "description" text NOT NULL DEFAULT '',
  "aliases" text[] NOT NULL DEFAULT ARRAY[]::text[],
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "lexicon_families_order_idx" ON "lexicon_families" ("chapter_order", "family_order");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "primitive_market_classifications" (
  "primitive_id" integer PRIMARY KEY NOT NULL REFERENCES "primitives"("id") ON DELETE CASCADE,
  "family_key" text NOT NULL REFERENCES "lexicon_families"("key") ON DELETE RESTRICT,
  "tier" integer,
  "expression_key" text,
  "canonical_template_id" integer,
  "canonical_expression_id" integer,
  "source" "primitive_classification_source" NOT NULL,
  "status" "primitive_classification_status" NOT NULL DEFAULT 'CLASSIFIED',
  "evidence" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "primitive_market_family_tier_idx" ON "primitive_market_classifications" ("family_key", "tier");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "primitive_market_expression_idx" ON "primitive_market_classifications" ("family_key", "expression_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "primitive_market_status_idx" ON "primitive_market_classifications" ("status");
