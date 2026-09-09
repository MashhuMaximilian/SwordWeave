-- PLAN Eilxina Part C (Mashu 2026-09-09): character_proposals table for
-- the proposal-and-approve flow. A shared EDITOR can propose a slot
-- change (a primitive/capability/item version bump) on the owner's
-- character; the OWNER reviews the two-panel diff and approves/rejects.
--
-- Lifecycle: PENDING → APPROVED → APPLIED (terminal)
--                       → REJECTED (terminal)
--                       → SUPERSEDED (terminal, auto-set when the
--                                    slot is bumped by another path
--                                    while this proposal is PENDING)
--
-- target_kind is intentionally an enum: PRIMITIVE | CAPABILITY | ITEM.
-- Adding new kinds (e.g. CHARACTER_EDIT, VITALITY_CHANGE) later means
-- ALTER TYPE ... ADD VALUE 'NEW_KIND' — no schema migration needed.

CREATE TYPE "character_proposal_status" AS ENUM (
  'PENDING',
  'APPROVED',
  'REJECTED',
  'APPLIED',
  'SUPERSEDED'
);

CREATE TYPE "character_proposal_target_kind" AS ENUM (
  'PRIMITIVE',
  'CAPABILITY',
  'ITEM'
);

CREATE TABLE "character_proposals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "character_id" uuid NOT NULL
    REFERENCES characters(id) ON DELETE CASCADE,
  "proposer_user_id" text NOT NULL
    REFERENCES users(clerk_user_id) ON DELETE CASCADE,
  "target_kind" character_proposal_target_kind NOT NULL,
  "target_id" text NOT NULL,
  "current_version_id" text NOT NULL,
  "proposed_version_id" text NOT NULL,
  "proposed_diff" jsonb NOT NULL,
  "rationale" text,
  "status" character_proposal_status NOT NULL DEFAULT 'PENDING',
  "reviewer_user_id" text
    REFERENCES users(clerk_user_id) ON DELETE SET NULL,
  "reviewer_note" text,
  "reviewed_at" timestamptz,
  "applied_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "character_proposals_character_idx"
  ON "character_proposals" ("character_id");
CREATE INDEX "character_proposals_proposer_idx"
  ON "character_proposals" ("proposer_user_id");
CREATE INDEX "character_proposals_status_idx"
  ON "character_proposals" ("status");
CREATE INDEX "character_proposals_character_status_idx"
  ON "character_proposals" ("character_id", "status");
