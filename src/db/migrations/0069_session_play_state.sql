CREATE TABLE IF NOT EXISTS play_states (
 subject_kind text NOT NULL CHECK (subject_kind IN ('CHARACTER','MONSTER_PLAY_COPY')),
 subject_id uuid NOT NULL, revision integer NOT NULL DEFAULT 0,
 overrides jsonb NOT NULL DEFAULT '{}', field_revisions jsonb NOT NULL DEFAULT '{}',
 updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(subject_kind,subject_id)
);
CREATE TABLE IF NOT EXISTS play_state_operations (
 subject_kind text NOT NULL, subject_id uuid NOT NULL, op_id uuid NOT NULL,
 request_hash text NOT NULL, revision integer NOT NULL, expires_at timestamptz NOT NULL,
 PRIMARY KEY(subject_kind,subject_id,op_id),
 FOREIGN KEY(subject_kind,subject_id) REFERENCES play_states(subject_kind,subject_id) ON DELETE CASCADE
);

-- Generic subjects cannot use a character-only FK. Database cleanup covers
-- both character delete APIs and administrative/direct deletion paths.
CREATE OR REPLACE FUNCTION cleanup_character_play_state() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 DELETE FROM play_states WHERE subject_kind='CHARACTER' AND subject_id=OLD.id;
 RETURN OLD;
END $$;
DROP TRIGGER IF EXISTS characters_cleanup_play_state ON characters;
CREATE TRIGGER characters_cleanup_play_state AFTER DELETE ON characters
 FOR EACH ROW EXECUTE FUNCTION cleanup_character_play_state();
