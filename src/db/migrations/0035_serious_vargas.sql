ALTER TABLE "users" ADD COLUMN "is_admin" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "users_is_admin_idx" ON "users" USING btree ("is_admin");