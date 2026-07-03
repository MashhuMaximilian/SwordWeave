ALTER TABLE "primitives" ADD COLUMN "is_public" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "primitives" SET "is_public" = true WHERE "user_id" IS NULL;--> statement-breakpoint
CREATE INDEX "primitives_is_public_idx" ON "primitives" USING btree ("is_public");
