CREATE TABLE IF NOT EXISTS collections (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id text NOT NULL, name text NOT NULL,
 parent_id uuid REFERENCES collections(id) ON DELETE RESTRICT,
 visibility publish_visibility NOT NULL DEFAULT 'PRIVATE', system_kind text,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK (parent_id IS DISTINCT FROM id)
);
CREATE INDEX IF NOT EXISTS collections_owner_idx ON collections(owner_id);
CREATE UNIQUE INDEX IF NOT EXISTS collections_system_idx ON collections(owner_id,system_kind);
CREATE TABLE IF NOT EXISTS collection_entries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), collection_id uuid NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
 target_type text NOT NULL, target_id text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS collection_entries_unique_idx ON collection_entries(collection_id,target_type,target_id);
CREATE INDEX IF NOT EXISTS collection_entries_target_idx ON collection_entries(target_type,target_id);
CREATE TABLE IF NOT EXISTS collection_follows (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id text NOT NULL,
 collection_id uuid NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS collection_follows_unique_idx ON collection_follows(user_id,collection_id);
CREATE OR REPLACE FUNCTION prevent_collection_cycle() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(710070);
 IF NEW.parent_id IS NOT NULL AND EXISTS (
 WITH RECURSIVE ancestors AS (SELECT id,parent_id FROM collections WHERE id=NEW.parent_id UNION SELECT c.id,c.parent_id FROM collections c JOIN ancestors a ON c.id=a.parent_id)
 SELECT 1 FROM ancestors WHERE id=NEW.id
 ) THEN RAISE EXCEPTION 'Collection hierarchy cannot contain cycles'; END IF;
 IF NEW.parent_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM collections WHERE id=NEW.parent_id AND owner_id=NEW.owner_id) THEN RAISE EXCEPTION 'Parent must belong to the same owner'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS collections_no_cycles ON collections;
CREATE TRIGGER collections_no_cycles BEFORE INSERT OR UPDATE OF parent_id,owner_id ON collections FOR EACH ROW EXECUTE FUNCTION prevent_collection_cycle();

CREATE TABLE IF NOT EXISTS collection_sources (target_type text NOT NULL,target_id text NOT NULL,collection_id uuid NOT NULL REFERENCES collections(id) ON DELETE CASCADE,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
CREATE UNIQUE INDEX IF NOT EXISTS collection_sources_target_idx ON collection_sources(target_type,target_id);
