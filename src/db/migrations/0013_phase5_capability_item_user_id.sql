ALTER TABLE "capabilities" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "user_id" text;--> statement-breakpoint
CREATE INDEX "capabilities_user_id_idx" ON "capabilities" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "items_user_id_idx" ON "items" USING btree ("user_id");