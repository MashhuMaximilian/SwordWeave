CREATE TABLE character_workspace_fork_grants (
  character_id uuid NOT NULL,
  capability_id uuid NOT NULL,
  version_id uuid NOT NULL,
  root_edge_id text NOT NULL,
  source_capability_id uuid NOT NULL,
  PRIMARY KEY (character_id, capability_id),
  FOREIGN KEY (character_id, capability_id)
    REFERENCES character_capabilities (character_id, capability_id) ON DELETE CASCADE
);
