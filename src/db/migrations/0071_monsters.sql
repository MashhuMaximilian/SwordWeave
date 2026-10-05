CREATE TABLE IF NOT EXISTS monsters (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id text NOT NULL, name text NOT NULL, description text NOT NULL DEFAULT '', is_public boolean NOT NULL DEFAULT false, visibility text NOT NULL DEFAULT 'PRIVATE' CHECK (visibility IN ('PUBLIC','FOLLOWERS_ONLY','PRIVATE')), forked_from_id uuid, source_collection_id uuid, version integer NOT NULL DEFAULT 1, definition jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS monster_versions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), monster_id uuid NOT NULL REFERENCES monsters(id) ON DELETE CASCADE, version integer NOT NULL, definition jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE UNIQUE INDEX IF NOT EXISTS monster_versions_pin_idx ON monster_versions(monster_id, version);
CREATE TABLE IF NOT EXISTS monster_copies (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id text NOT NULL, name text NOT NULL, template_id uuid, template_version integer NOT NULL, template_version_id uuid REFERENCES monster_versions(id) ON DELETE RESTRICT, definition jsonb, current_vitality bigint NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());

CREATE INDEX IF NOT EXISTS monsters_user_updated_idx ON monsters(user_id,updated_at);
CREATE INDEX IF NOT EXISTS monsters_visibility_updated_idx ON monsters(visibility,updated_at);
CREATE INDEX IF NOT EXISTS monster_copies_user_idx ON monster_copies(user_id);
CREATE INDEX IF NOT EXISTS monster_copies_template_version_idx ON monster_copies(template_version_id);
