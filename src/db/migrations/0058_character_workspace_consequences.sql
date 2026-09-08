CREATE TABLE IF NOT EXISTS character_workspace_state (
  character_id uuid PRIMARY KEY REFERENCES characters(id) ON DELETE CASCADE,
  revision integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS character_consequences (
  character_id uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  occurrence_id text NOT NULL, revision integer NOT NULL DEFAULT 1,
  occurrence jsonb NOT NULL, deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (character_id, occurrence_id)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS character_workspace_commands (
  character_id uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  command_id text NOT NULL, kind text NOT NULL, request_hash text NOT NULL, result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (character_id, command_id)
);

--> statement-breakpoint
ALTER TABLE primitives ADD COLUMN IF NOT EXISTS consequence_behavior jsonb;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS character_effects (
  character_id uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  effect_id uuid NOT NULL REFERENCES effects(id) ON DELETE RESTRICT,
  category text NOT NULL DEFAULT 'MANIFEST', version_id uuid,
  slot_source text NOT NULL DEFAULT 'PINNED',
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (character_id, effect_id)
);
--> statement-breakpoint
INSERT INTO character_effects (character_id, effect_id, category)
SELECT DISTINCT ON (character_id, origin_effect_id) character_id, origin_effect_id,
  CASE WHEN source::text = 'PERSONAL' THEN 'MANIFEST' ELSE source::text END
FROM character_primitives
WHERE origin_effect_id IS NOT NULL AND origin_capability_id IS NULL
  AND origin_heritage_id IS NULL AND origin_item_id IS NULL
ORDER BY character_id, origin_effect_id, created_at
ON CONFLICT DO NOTHING;
--> statement-breakpoint
-- Compatibility columns already used by the shared composers and build schema.
ALTER TABLE effect_primitives ADD COLUMN IF NOT EXISTS target_who text NOT NULL DEFAULT 'self';
--> statement-breakpoint
ALTER TABLE capability_primitives ADD COLUMN IF NOT EXISTS target_who text NOT NULL DEFAULT 'self';
--> statement-breakpoint
ALTER TABLE builds ADD COLUMN IF NOT EXISTS manifest_id uuid REFERENCES heritage(id) ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE effects ADD COLUMN IF NOT EXISTS membership_order jsonb;
--> statement-breakpoint
ALTER TABLE capabilities ADD COLUMN IF NOT EXISTS membership_order jsonb;
--> statement-breakpoint
ALTER TABLE heritage ADD COLUMN IF NOT EXISTS membership_order jsonb;
--> statement-breakpoint
ALTER TABLE items ADD COLUMN IF NOT EXISTS membership_order jsonb;
--> statement-breakpoint
ALTER TABLE character_primitives ADD COLUMN IF NOT EXISTS direct_source character_primitive_source;
