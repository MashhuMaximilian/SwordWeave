CREATE TYPE "public"."character_attribute" AS ENUM('PHYSICAL', 'MENTAL', 'MAGICAL');--> statement-breakpoint
CREATE TYPE "public"."character_primitive_source" AS ENUM('RACE', 'BACKGROUND', 'PERSONAL', 'TRAINING', 'LEVEL_UP', 'DM');--> statement-breakpoint
CREATE TYPE "public"."character_size" AS ENUM('TINY', 'SMALL', 'MEDIUM', 'LARGE', 'HUGE', 'GARGANTUAN');--> statement-breakpoint
CREATE TYPE "public"."item_size" AS ENUM('TINY', 'SMALL', 'MEDIUM', 'LARGE', 'HUGE', 'GARGANTUAN');--> statement-breakpoint
CREATE TYPE "public"."template_kind" AS ENUM('RACE', 'BACKGROUND', 'ARCHETYPE');--> statement-breakpoint
CREATE TABLE "item_primitives" (
	"item_id" uuid NOT NULL,
	"primitive_id" integer NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "item_primitives_pk" PRIMARY KEY("item_id","primitive_id")
);
--> statement-breakpoint
CREATE TABLE "build_capabilities" (
	"build_id" uuid NOT NULL,
	"capability_id" uuid NOT NULL,
	"acquired_at_level" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "build_capabilities_pk" PRIMARY KEY("build_id","capability_id")
);
--> statement-breakpoint
CREATE TABLE "builds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"name" text NOT NULL,
	"description" text,
	"level" integer DEFAULT 1 NOT NULL,
	"starting_bu" integer DEFAULT 25 NOT NULL,
	"is_archetype_template" boolean DEFAULT false NOT NULL,
	"race_name" text,
	"race_description" text,
	"background_name" text,
	"background_description" text,
	"archetype_name" text,
	"attr_physical" integer,
	"attr_mental" integer,
	"attr_magical" integer,
	"attr_proficient" character_attribute,
	"practice_slices" jsonb,
	"portrait_url" text,
	"race_id" uuid,
	"background_id" uuid,
	"is_public" boolean DEFAULT false NOT NULL,
	"source_origin" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "builds_level_range_check" CHECK ("builds"."level" BETWEEN 1 AND 20)
);
--> statement-breakpoint
CREATE TABLE "character_capabilities" (
	"character_id" uuid NOT NULL,
	"capability_id" uuid NOT NULL,
	"acquired_at_level" integer DEFAULT 1 NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "character_capabilities_pk" PRIMARY KEY("character_id","capability_id")
);
--> statement-breakpoint
CREATE TABLE "character_items" (
	"character_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"equipped" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "character_items_pk" PRIMARY KEY("character_id","item_id")
);
--> statement-breakpoint
CREATE TABLE "character_primitives" (
	"character_id" uuid NOT NULL,
	"primitive_id" integer NOT NULL,
	"source" character_primitive_source DEFAULT 'PERSONAL' NOT NULL,
	"acquired_at_level" integer DEFAULT 1 NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "character_primitives_pk" PRIMARY KEY("character_id","primitive_id")
);
--> statement-breakpoint
CREATE TABLE "characters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"name" text NOT NULL,
	"size" character_size DEFAULT 'MEDIUM' NOT NULL,
	"race_name" text,
	"race_image_url" text,
	"race_description" text,
	"background_name" text,
	"background_image_url" text,
	"background_description" text,
	"archetype_name" text,
	"level" integer DEFAULT 1 NOT NULL,
	"attr_physical" integer DEFAULT 0 NOT NULL,
	"attr_mental" integer DEFAULT 0 NOT NULL,
	"attr_magical" integer DEFAULT 0 NOT NULL,
	"attr_proficient" character_attribute,
	"practice_slices" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"current_vitality" integer,
	"starting_bu" integer DEFAULT 25 NOT NULL,
	"bu_spent" integer DEFAULT 0 NOT NULL,
	"dm_bonus_bu" integer DEFAULT 0 NOT NULL,
	"enforce_template_caps" boolean DEFAULT false NOT NULL,
	"is_mirrored" boolean DEFAULT false NOT NULL,
	"notes" text,
	"dm_notes" text,
	"portrait_url" text,
	"is_public" boolean DEFAULT false NOT NULL,
	"source_origin" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "characters_attr_sum_check" CHECK ("characters"."attr_physical" + "characters"."attr_mental" + "characters"."attr_magical" = 10
          AND "characters"."attr_physical" BETWEEN -1 AND 5
          AND "characters"."attr_mental" BETWEEN -1 AND 5
          AND "characters"."attr_magical" BETWEEN -1 AND 5),
	CONSTRAINT "characters_level_range_check" CHECK ("characters"."level" BETWEEN 1 AND 20),
	CONSTRAINT "characters_bu_progression_check" CHECK ("characters"."bu_spent" <= "characters"."starting_bu" + ("characters"."level" - 1) * 5 + "characters"."dm_bonus_bu"),
	CONSTRAINT "characters_starting_bu_check" CHECK ("characters"."starting_bu" >= 0 AND "characters"."starting_bu" <= 1000)
);
--> statement-breakpoint
CREATE TABLE "template_capabilities" (
	"template_id" uuid NOT NULL,
	"capability_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "template_capabilities_pk" PRIMARY KEY("template_id","capability_id")
);
--> statement-breakpoint
CREATE TABLE "template_primitives" (
	"template_id" uuid NOT NULL,
	"primitive_id" integer NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "template_primitives_pk" PRIMARY KEY("template_id","primitive_id")
);
--> statement-breakpoint
CREATE TABLE "templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"kind" "template_kind" NOT NULL,
	"name" text NOT NULL,
	"image_url" text,
	"description" text,
	"suggested_traits" text,
	"is_public" boolean DEFAULT false NOT NULL,
	"source_origin" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "templates_user_name_kind_unique" UNIQUE("name","user_id","kind")
);
--> statement-breakpoint
ALTER TABLE "item_primitives" ADD CONSTRAINT "item_primitives_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_primitives" ADD CONSTRAINT "item_primitives_primitive_id_primitives_id_fk" FOREIGN KEY ("primitive_id") REFERENCES "public"."primitives"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "build_capabilities" ADD CONSTRAINT "build_capabilities_build_id_builds_id_fk" FOREIGN KEY ("build_id") REFERENCES "public"."builds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "build_capabilities" ADD CONSTRAINT "build_capabilities_capability_id_capabilities_id_fk" FOREIGN KEY ("capability_id") REFERENCES "public"."capabilities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "builds" ADD CONSTRAINT "builds_race_id_templates_id_fk" FOREIGN KEY ("race_id") REFERENCES "public"."templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "builds" ADD CONSTRAINT "builds_background_id_templates_id_fk" FOREIGN KEY ("background_id") REFERENCES "public"."templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_capabilities" ADD CONSTRAINT "character_capabilities_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_capabilities" ADD CONSTRAINT "character_capabilities_capability_id_capabilities_id_fk" FOREIGN KEY ("capability_id") REFERENCES "public"."capabilities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_items" ADD CONSTRAINT "character_items_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_items" ADD CONSTRAINT "character_items_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_primitives" ADD CONSTRAINT "character_primitives_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_primitives" ADD CONSTRAINT "character_primitives_primitive_id_primitives_id_fk" FOREIGN KEY ("primitive_id") REFERENCES "public"."primitives"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_capabilities" ADD CONSTRAINT "template_capabilities_template_id_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_capabilities" ADD CONSTRAINT "template_capabilities_capability_id_capabilities_id_fk" FOREIGN KEY ("capability_id") REFERENCES "public"."capabilities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_primitives" ADD CONSTRAINT "template_primitives_template_id_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_primitives" ADD CONSTRAINT "template_primitives_primitive_id_primitives_id_fk" FOREIGN KEY ("primitive_id") REFERENCES "public"."primitives"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "item_primitives_item_id_idx" ON "item_primitives" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "item_primitives_primitive_id_idx" ON "item_primitives" USING btree ("primitive_id");--> statement-breakpoint
CREATE INDEX "build_capabilities_build_id_idx" ON "build_capabilities" USING btree ("build_id");--> statement-breakpoint
CREATE INDEX "build_capabilities_capability_id_idx" ON "build_capabilities" USING btree ("capability_id");--> statement-breakpoint
CREATE INDEX "builds_user_id_idx" ON "builds" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "builds_is_public_idx" ON "builds" USING btree ("is_public");--> statement-breakpoint
CREATE INDEX "builds_is_archetype_idx" ON "builds" USING btree ("is_archetype_template");--> statement-breakpoint
CREATE INDEX "character_capabilities_character_id_idx" ON "character_capabilities" USING btree ("character_id");--> statement-breakpoint
CREATE INDEX "character_capabilities_capability_id_idx" ON "character_capabilities" USING btree ("capability_id");--> statement-breakpoint
CREATE INDEX "character_items_character_id_idx" ON "character_items" USING btree ("character_id");--> statement-breakpoint
CREATE INDEX "character_items_item_id_idx" ON "character_items" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "character_primitives_character_id_idx" ON "character_primitives" USING btree ("character_id");--> statement-breakpoint
CREATE INDEX "character_primitives_primitive_id_idx" ON "character_primitives" USING btree ("primitive_id");--> statement-breakpoint
CREATE INDEX "characters_user_id_idx" ON "characters" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "characters_is_public_idx" ON "characters" USING btree ("is_public");--> statement-breakpoint
CREATE INDEX "characters_user_name_idx" ON "characters" USING btree ("user_id","name");--> statement-breakpoint
CREATE INDEX "template_capabilities_template_id_idx" ON "template_capabilities" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "template_capabilities_capability_id_idx" ON "template_capabilities" USING btree ("capability_id");--> statement-breakpoint
CREATE INDEX "template_primitives_template_id_idx" ON "template_primitives" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "template_primitives_primitive_id_idx" ON "template_primitives" USING btree ("primitive_id");--> statement-breakpoint
CREATE INDEX "templates_user_id_idx" ON "templates" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "templates_kind_idx" ON "templates" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "templates_is_public_idx" ON "templates" USING btree ("is_public");