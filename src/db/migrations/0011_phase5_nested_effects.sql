CREATE TABLE "effect_effects" (
	"parent_effect_id" uuid NOT NULL,
	"child_effect_id" uuid NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"slot_label" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "effect_effects_pk" PRIMARY KEY("parent_effect_id","child_effect_id")
);
--> statement-breakpoint
ALTER TABLE "effect_effects" ADD CONSTRAINT "effect_effects_parent_effect_id_effects_id_fk" FOREIGN KEY ("parent_effect_id") REFERENCES "public"."effects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "effect_effects" ADD CONSTRAINT "effect_effects_child_effect_id_effects_id_fk" FOREIGN KEY ("child_effect_id") REFERENCES "public"."effects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "effect_effects_parent_idx" ON "effect_effects" USING btree ("parent_effect_id");--> statement-breakpoint
CREATE INDEX "effect_effects_child_idx" ON "effect_effects" USING btree ("child_effect_id");