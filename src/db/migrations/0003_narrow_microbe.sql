ALTER TABLE "effects" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "primitives" ADD COLUMN "user_id" text;--> statement-breakpoint
CREATE INDEX "effects_user_id_idx" ON "effects" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "primitives_user_id_idx" ON "primitives" USING btree ("user_id");