ALTER TABLE "encounters" ADD COLUMN IF NOT EXISTS "visibility" text NOT NULL DEFAULT 'PRIVATE';
--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='encounters_visibility_check' AND conrelid='encounters'::regclass) THEN ALTER TABLE "encounters" ADD CONSTRAINT "encounters_visibility_check" CHECK (visibility IN ('PRIVATE','FOLLOWERS_ONLY','PUBLIC')); END IF; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "encounters_visibility_updated_idx" ON "encounters" ("visibility", "updated_at");
