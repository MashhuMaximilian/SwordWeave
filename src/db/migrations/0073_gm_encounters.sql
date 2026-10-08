ALTER TABLE users ADD COLUMN IF NOT EXISTS is_game_master boolean NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS encounters(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),owner_id text NOT NULL,name text NOT NULL,revision integer NOT NULL DEFAULT 0,definition jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS encounters_owner_idx ON encounters(owner_id,updated_at);
CREATE TABLE IF NOT EXISTS encounter_entries(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),encounter_id uuid NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,template_id uuid NOT NULL,version_id uuid NOT NULL REFERENCES monster_versions(id) ON DELETE RESTRICT,version integer NOT NULL CHECK(version>0),quantity integer NOT NULL CHECK(quantity BETWEEN 1 AND 200));
CREATE UNIQUE INDEX IF NOT EXISTS encounter_entry_pin_idx ON encounter_entries(encounter_id,version_id);
CREATE TABLE IF NOT EXISTS encounter_runs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),encounter_id uuid REFERENCES encounters(id) ON DELETE SET NULL,owner_id text NOT NULL,name text NOT NULL,start_op_id uuid NOT NULL,party jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
CREATE UNIQUE INDEX IF NOT EXISTS encounter_start_op_idx ON encounter_runs(owner_id,start_op_id);
CREATE INDEX IF NOT EXISTS encounter_runs_owner_idx ON encounter_runs(owner_id,encounter_id);
CREATE TABLE IF NOT EXISTS encounter_run_copies(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),run_id uuid NOT NULL REFERENCES encounter_runs(id) ON DELETE CASCADE,copy_id uuid REFERENCES monster_copies(id) ON DELETE SET NULL,name text NOT NULL,position integer NOT NULL);
CREATE INDEX IF NOT EXISTS encounter_run_members_idx ON encounter_run_copies(run_id);
CREATE UNIQUE INDEX IF NOT EXISTS encounter_copy_membership_idx ON encounter_run_copies(copy_id);
CREATE OR REPLACE FUNCTION cleanup_encounter_run_state() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN DELETE FROM play_states WHERE subject_kind='ENCOUNTER_RUN' AND subject_id=OLD.id; DELETE FROM play_state_operations WHERE subject_kind='ENCOUNTER_RUN' AND subject_id=OLD.id; RETURN OLD; END $$;
DROP TRIGGER IF EXISTS encounter_run_state_cleanup ON encounter_runs;
CREATE TRIGGER encounter_run_state_cleanup AFTER DELETE ON encounter_runs FOR EACH ROW EXECUTE FUNCTION cleanup_encounter_run_state();

ALTER TABLE play_states DROP CONSTRAINT IF EXISTS play_states_subject_kind_check;
ALTER TABLE play_states ADD CONSTRAINT play_states_subject_kind_check CHECK(subject_kind IN ('CHARACTER','MONSTER_PLAY_COPY','ENCOUNTER_RUN'));
