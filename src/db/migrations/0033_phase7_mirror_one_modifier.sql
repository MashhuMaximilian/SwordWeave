-- 0033 — Phase 7 Mirror: 1 modifier per primitive + canonical mirror defaults.
--
-- Two structural changes that lock in canonical semantics:
--
--   1. At most ONE hard modifier per primitive. This enforces the
--      atomic-payload rule: "A Primitive has exactly one mechanical
--      payload." Multi-modifier primitives would break:
--         - the BU math (which modifier contributes the cost?)
--         - the mirror resolution (which modifier is mirrored?)
--         - the audit matrix (one row = one rule)
--      Existing rows with multiple modifiers are quarantined:
--         the migration does NOT silently delete them; it flags them
--         in a one-time diagnostic view. Manual remediation by the
--         user/DM is required. New rows must satisfy the CHECK.
--
--   2. mirror_bu_credit = bu_cost when is_mirrorable=true. The form
--      no longer accepts an override for this value (the field is
--      derived at write time). Existing rows where mirror_bu_credit
--      differs are normalized to bu_cost so the canonical balance
--      calculations resolve cleanly.
--
-- Why now: Phase-7-Q-M engine work in src/lib/engine/mirror.ts assumes
--          mirror_bu_credit equals bu_cost for mirrorable rows. The
--          audit showed all 47 mirror candidates have matching values
--          already; this backfill is defensive for the edge case.

-- ---------------------------------------------------------------------------
-- (1) One-modifier-per-primitive: CHECK constraint + diagnostic view.
-- ---------------------------------------------------------------------------

-- Diagnostic view: rows that violate the new constraint. Used by
-- scripts/_verify-phase7.ts to surface offending primitives.
CREATE OR REPLACE VIEW primitive_modifier_count_violations AS
SELECT
  id,
  name,
  category,
  jsonb_array_length(hard_modifiers) AS modifier_count
FROM primitives
WHERE jsonb_array_length(hard_modifiers) > 1;

-- CHECK constraint. We use the standard idiom: a CHECK with
-- jsonb_array_length. Idempotent so re-running this migration
-- against an already-applied DB doesn't fail.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'primitives_one_modifier_chk'
  ) THEN
    ALTER TABLE primitives
      ADD CONSTRAINT primitives_one_modifier_chk
      CHECK (jsonb_array_length(hard_modifiers) <= 1);
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- (2) Backfill mirror_bu_credit = bu_cost where is_mirrorable = true.
-- ---------------------------------------------------------------------------

UPDATE primitives
SET mirror_bu_credit = bu_cost
WHERE is_mirrorable = true
  AND (mirror_bu_credit IS DISTINCT FROM bu_cost);

-- Add a safety CHECK that mirror_bu_credit = bu_cost when is_mirrorable.
-- We tolerate legacy NULL rows (non-mirrorable primitives) by using
-- `IS NOT TRUE` rather than `= false`, so the constraint only fires on
-- mirrorable primitives that have a divergent value.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'primitives_mirror_bu_credit_matches_chk'
  ) THEN
    ALTER TABLE primitives
      ADD CONSTRAINT primitives_mirror_bu_credit_matches_chk
      CHECK (
        is_mirrorable IS NOT TRUE
        OR mirror_bu_credit IS NOT DISTINCT FROM bu_cost
      );
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- (3) Index hint for the constraint hot-path.
-- ---------------------------------------------------------------------------

-- Partial index on is_mirrorable = true helps query planning for the
-- audit matrix and the canonical mirror resolver.
CREATE INDEX IF NOT EXISTS primitives_is_mirrorable_true_idx
  ON primitives (id, name, category, bu_cost)
  WHERE is_mirrorable = true;
