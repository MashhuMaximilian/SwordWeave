ALTER TABLE "characters"
ADD COLUMN IF NOT EXISTS "portrait_frame" jsonb NOT NULL
DEFAULT '{"x":50,"y":50,"zoom":1}'::jsonb;
