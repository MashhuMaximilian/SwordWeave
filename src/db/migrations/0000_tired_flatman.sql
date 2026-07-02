CREATE TYPE "public"."capability_primitive_role" AS ENUM('VERB', 'DOMAIN', 'SIZING', 'RANGE', 'DURATION', 'OUTPUT', 'AUGMENT', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."capability_type" AS ENUM('ACTIVE', 'PASSIVE', 'AUGMENT');--> statement-breakpoint
CREATE TYPE "public"."entity_type" AS ENUM('PLAYER', 'MONSTER', 'RACE_TEMPLATE', 'BACKGROUND_TEMPLATE', 'BUILD_TEMPLATE');--> statement-breakpoint
CREATE TYPE "public"."item_rarity" AS ENUM('COMMON', 'RARE', 'EPIC', 'LEGENDARY');--> statement-breakpoint
CREATE TYPE "public"."item_type" AS ENUM('WEAPON', 'ARMOR', 'TRINKET', 'ARTIFACT', 'CONSUMABLE');--> statement-breakpoint
CREATE TYPE "public"."primitive_category" AS ENUM('VERB_TIER', 'DOMAIN', 'SIZING', 'RANGE', 'DURATION', 'SHEET_AUGMENT');--> statement-breakpoint
CREATE TYPE "public"."source_type" AS ENUM('PHYSICAL', 'MAGICAL', 'PSYCHIC');--> statement-breakpoint
CREATE TABLE "capabilities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" "capability_type" NOT NULL,
	"source_type" "source_type" NOT NULL,
	"verbose_description" text DEFAULT '' NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"source_origin" text,
	"tags" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "capability_effects" (
	"capability_id" uuid NOT NULL,
	"effect_id" uuid NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"slot_label" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "capability_effects_pk" PRIMARY KEY("capability_id","effect_id")
);
--> statement-breakpoint
CREATE TABLE "capability_primitives" (
	"capability_id" uuid NOT NULL,
	"primitive_id" integer NOT NULL,
	"role" "capability_primitive_role" NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"slot_label" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "capability_primitives_pk" PRIMARY KEY("capability_id","primitive_id","role")
);
--> statement-breakpoint
CREATE TABLE "condition_primitives" (
	"condition_id" uuid NOT NULL,
	"primitive_id" integer NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "condition_primitives_pk" PRIMARY KEY("condition_id","primitive_id")
);
--> statement-breakpoint
CREATE TABLE "conditions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "effect_conditions" (
	"effect_id" uuid NOT NULL,
	"condition_id" uuid NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "effect_conditions_pk" PRIMARY KEY("effect_id","condition_id")
);
--> statement-breakpoint
CREATE TABLE "effect_primitives" (
	"effect_id" uuid NOT NULL,
	"primitive_id" integer NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "effect_primitives_pk" PRIMARY KEY("effect_id","primitive_id")
);
--> statement-breakpoint
CREATE TABLE "effects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"narrative_description" text DEFAULT '' NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"source_origin" text,
	"tags" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "primitives" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" "primitive_category" NOT NULL,
	"bu_cost" integer DEFAULT 0 NOT NULL,
	"hard_modifiers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"name" text NOT NULL,
	"entity_type" "entity_type" NOT NULL,
	"level" integer DEFAULT 1 NOT NULL,
	"cumulative_bu_budget" integer DEFAULT 0 NOT NULL,
	"current_vitality" integer DEFAULT 0 NOT NULL,
	"physical" integer DEFAULT 0 NOT NULL,
	"mental" integer DEFAULT 0 NOT NULL,
	"magical" integer DEFAULT 0 NOT NULL,
	"presence" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entity_capabilities" (
	"entity_id" uuid NOT NULL,
	"capability_id" uuid NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"loadout_slot" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "entity_capabilities_pk" PRIMARY KEY("entity_id","capability_id")
);
--> statement-breakpoint
CREATE TABLE "entity_primitives" (
	"entity_id" uuid NOT NULL,
	"primitive_id" integer NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"source_label" text,
	"is_permanent" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "entity_primitives_pk" PRIMARY KEY("entity_id","primitive_id")
);
--> statement-breakpoint
CREATE TABLE "entity_inventory" (
	"entity_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"is_equipped" boolean DEFAULT false NOT NULL,
	"equipped_slot" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "entity_inventory_pk" PRIMARY KEY("entity_id","item_id")
);
--> statement-breakpoint
CREATE TABLE "item_capabilities" (
	"item_id" uuid NOT NULL,
	"capability_id" uuid NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"slot_label" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "item_capabilities_pk" PRIMARY KEY("item_id","capability_id")
);
--> statement-breakpoint
CREATE TABLE "item_effects" (
	"item_id" uuid NOT NULL,
	"effect_id" uuid NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"slot_label" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "item_effects_pk" PRIMARY KEY("item_id","effect_id")
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"item_type" "item_type" NOT NULL,
	"rarity" "item_rarity" DEFAULT 'COMMON' NOT NULL,
	"bu_cost" integer DEFAULT 0 NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"slot_cost" integer DEFAULT 1 NOT NULL,
	"is_two_handed" boolean DEFAULT false NOT NULL,
	"is_consumable" boolean DEFAULT false NOT NULL,
	"acts_as_focus" boolean DEFAULT true NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"source_origin" text,
	"tags" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "capability_effects" ADD CONSTRAINT "capability_effects_capability_id_capabilities_id_fk" FOREIGN KEY ("capability_id") REFERENCES "public"."capabilities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capability_effects" ADD CONSTRAINT "capability_effects_effect_id_effects_id_fk" FOREIGN KEY ("effect_id") REFERENCES "public"."effects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capability_primitives" ADD CONSTRAINT "capability_primitives_capability_id_capabilities_id_fk" FOREIGN KEY ("capability_id") REFERENCES "public"."capabilities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capability_primitives" ADD CONSTRAINT "capability_primitives_primitive_id_primitives_id_fk" FOREIGN KEY ("primitive_id") REFERENCES "public"."primitives"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "condition_primitives" ADD CONSTRAINT "condition_primitives_condition_id_conditions_id_fk" FOREIGN KEY ("condition_id") REFERENCES "public"."conditions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "condition_primitives" ADD CONSTRAINT "condition_primitives_primitive_id_primitives_id_fk" FOREIGN KEY ("primitive_id") REFERENCES "public"."primitives"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "effect_conditions" ADD CONSTRAINT "effect_conditions_effect_id_effects_id_fk" FOREIGN KEY ("effect_id") REFERENCES "public"."effects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "effect_conditions" ADD CONSTRAINT "effect_conditions_condition_id_conditions_id_fk" FOREIGN KEY ("condition_id") REFERENCES "public"."conditions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "effect_primitives" ADD CONSTRAINT "effect_primitives_effect_id_effects_id_fk" FOREIGN KEY ("effect_id") REFERENCES "public"."effects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "effect_primitives" ADD CONSTRAINT "effect_primitives_primitive_id_primitives_id_fk" FOREIGN KEY ("primitive_id") REFERENCES "public"."primitives"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_capabilities" ADD CONSTRAINT "entity_capabilities_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_capabilities" ADD CONSTRAINT "entity_capabilities_capability_id_capabilities_id_fk" FOREIGN KEY ("capability_id") REFERENCES "public"."capabilities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_primitives" ADD CONSTRAINT "entity_primitives_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_primitives" ADD CONSTRAINT "entity_primitives_primitive_id_primitives_id_fk" FOREIGN KEY ("primitive_id") REFERENCES "public"."primitives"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_inventory" ADD CONSTRAINT "entity_inventory_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_inventory" ADD CONSTRAINT "entity_inventory_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_capabilities" ADD CONSTRAINT "item_capabilities_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_capabilities" ADD CONSTRAINT "item_capabilities_capability_id_capabilities_id_fk" FOREIGN KEY ("capability_id") REFERENCES "public"."capabilities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_effects" ADD CONSTRAINT "item_effects_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_effects" ADD CONSTRAINT "item_effects_effect_id_effects_id_fk" FOREIGN KEY ("effect_id") REFERENCES "public"."effects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "capabilities_type_idx" ON "capabilities" USING btree ("type");--> statement-breakpoint
CREATE INDEX "capabilities_source_type_idx" ON "capabilities" USING btree ("source_type");--> statement-breakpoint
CREATE INDEX "capabilities_is_public_idx" ON "capabilities" USING btree ("is_public");--> statement-breakpoint
CREATE INDEX "capabilities_tags_idx" ON "capabilities" USING gin ("tags");--> statement-breakpoint
CREATE UNIQUE INDEX "capabilities_name_source_origin_unique_idx" ON "capabilities" USING btree ("name","source_origin");--> statement-breakpoint
CREATE INDEX "capability_effects_capability_id_idx" ON "capability_effects" USING btree ("capability_id");--> statement-breakpoint
CREATE INDEX "capability_effects_effect_id_idx" ON "capability_effects" USING btree ("effect_id");--> statement-breakpoint
CREATE INDEX "capability_primitives_capability_id_idx" ON "capability_primitives" USING btree ("capability_id");--> statement-breakpoint
CREATE INDEX "capability_primitives_primitive_id_idx" ON "capability_primitives" USING btree ("primitive_id");--> statement-breakpoint
CREATE INDEX "capability_primitives_role_idx" ON "capability_primitives" USING btree ("role");--> statement-breakpoint
CREATE INDEX "condition_primitives_condition_id_idx" ON "condition_primitives" USING btree ("condition_id");--> statement-breakpoint
CREATE INDEX "condition_primitives_primitive_id_idx" ON "condition_primitives" USING btree ("primitive_id");--> statement-breakpoint
CREATE UNIQUE INDEX "conditions_name_unique_idx" ON "conditions" USING btree ("name");--> statement-breakpoint
CREATE INDEX "effect_conditions_effect_id_idx" ON "effect_conditions" USING btree ("effect_id");--> statement-breakpoint
CREATE INDEX "effect_conditions_condition_id_idx" ON "effect_conditions" USING btree ("condition_id");--> statement-breakpoint
CREATE INDEX "effect_primitives_effect_id_idx" ON "effect_primitives" USING btree ("effect_id");--> statement-breakpoint
CREATE INDEX "effect_primitives_primitive_id_idx" ON "effect_primitives" USING btree ("primitive_id");--> statement-breakpoint
CREATE INDEX "effects_is_public_idx" ON "effects" USING btree ("is_public");--> statement-breakpoint
CREATE INDEX "effects_tags_idx" ON "effects" USING gin ("tags");--> statement-breakpoint
CREATE UNIQUE INDEX "effects_name_source_origin_unique_idx" ON "effects" USING btree ("name","source_origin");--> statement-breakpoint
CREATE INDEX "primitives_category_idx" ON "primitives" USING btree ("category");--> statement-breakpoint
CREATE UNIQUE INDEX "primitives_name_category_unique_idx" ON "primitives" USING btree ("name","category");--> statement-breakpoint
CREATE INDEX "entities_user_id_idx" ON "entities" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "entities_entity_type_idx" ON "entities" USING btree ("entity_type");--> statement-breakpoint
CREATE INDEX "entities_user_type_idx" ON "entities" USING btree ("user_id","entity_type");--> statement-breakpoint
CREATE INDEX "entity_capabilities_entity_id_idx" ON "entity_capabilities" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "entity_capabilities_capability_id_idx" ON "entity_capabilities" USING btree ("capability_id");--> statement-breakpoint
CREATE INDEX "entity_primitives_entity_id_idx" ON "entity_primitives" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "entity_primitives_primitive_id_idx" ON "entity_primitives" USING btree ("primitive_id");--> statement-breakpoint
CREATE INDEX "entity_inventory_entity_id_idx" ON "entity_inventory" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "entity_inventory_item_id_idx" ON "entity_inventory" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "entity_inventory_equipped_idx" ON "entity_inventory" USING btree ("is_equipped");--> statement-breakpoint
CREATE INDEX "item_capabilities_item_id_idx" ON "item_capabilities" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "item_capabilities_capability_id_idx" ON "item_capabilities" USING btree ("capability_id");--> statement-breakpoint
CREATE INDEX "item_effects_item_id_idx" ON "item_effects" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "item_effects_effect_id_idx" ON "item_effects" USING btree ("effect_id");--> statement-breakpoint
CREATE INDEX "items_item_type_idx" ON "items" USING btree ("item_type");--> statement-breakpoint
CREATE INDEX "items_rarity_idx" ON "items" USING btree ("rarity");--> statement-breakpoint
CREATE INDEX "items_is_public_idx" ON "items" USING btree ("is_public");--> statement-breakpoint
CREATE INDEX "items_tags_idx" ON "items" USING gin ("tags");--> statement-breakpoint
CREATE UNIQUE INDEX "items_name_source_origin_unique_idx" ON "items" USING btree ("name","source_origin");