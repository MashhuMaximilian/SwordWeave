CREATE TABLE "effect_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"effect_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"is_latest" boolean DEFAULT false NOT NULL,
	"delta_kind" "version_delta_kind" NOT NULL,
	"snapshot" jsonb NOT NULL,
	"published_by_user_id" uuid,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"superseded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "item_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"is_latest" boolean DEFAULT false NOT NULL,
	"delta_kind" "version_delta_kind" NOT NULL,
	"snapshot" jsonb NOT NULL,
	"published_by_user_id" uuid,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"superseded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "effect_versions_id_version_unique_idx" ON "effect_versions" USING btree ("effect_id","version_number");--> statement-breakpoint
CREATE INDEX "effect_versions_effect_id_idx" ON "effect_versions" USING btree ("effect_id");--> statement-breakpoint
CREATE INDEX "effect_versions_is_latest_idx" ON "effect_versions" USING btree ("is_latest");--> statement-breakpoint
CREATE UNIQUE INDEX "item_versions_id_version_unique_idx" ON "item_versions" USING btree ("item_id","version_number");--> statement-breakpoint
CREATE INDEX "item_versions_item_id_idx" ON "item_versions" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "item_versions_is_latest_idx" ON "item_versions" USING btree ("is_latest");