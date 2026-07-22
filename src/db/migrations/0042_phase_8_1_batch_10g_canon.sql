-- =============================================================================
-- Migration 0042: Phase 8.1 batch 10g — canon BU formula + no level cap
-- =============================================================================
-- Hand-written because drizzle-kit 0.31 fails on enum conflicts unrelated
-- to these changes (interactive prompt unavailable in non-TTY contexts).
-- The schema diff itself is three CHECK constraint swaps on `characters`:
--
--   1. characters_level_range_check → characters_level_min_check
--      Old: BETWEEN 1 AND 20 (capped at 20)
--      New: >= 1 (no upper cap; cumulative BU formula extrapolates
--      indefinitely, e.g. L100 = 2315 BU canon pool).
--
--   2. characters_bu_progression_check
--      Old: bu_spent <= starting_bu + (level-1)*5 + dm_bonus_bu
--      (gave 40 at L4 instead of canon 59; was wrong at every spike).
--      New: bu_spent <= GREATEST(starting_bu,
--                                25 + 10*(level-1)
--                                + 4*(level/4)*(level/4 + 1)/2
--                       ) + dm_bonus_bu
--      Integer division L/4 gives k = floor(L/4), so the inner
--      arithmetic matches the TS cumulativeBuForLevel exactly.
--      The GREATEST() lets "By BU" mode's starting_bu override win
--      over the canon for the implied level (e.g. user typed 200 BU
--      → pool = 200 at L10 even though canon cumulative(10) = 127).
--
--   3. characters_starting_bu_check
--      Old: starting_bu <= 1000
--      New: starting_bu <= 100000 (lets users size L100-level budgets
--      via buBudget mode without tripping the constraint).
--
-- Existing data is unaffected by all three changes: the new level check
-- is strictly weaker (L >= 1 only), the new BU progression check is
-- strictly weaker at spike levels and stricter for "By BU" mode (which
-- previously wasn't enforced server-side at all), and the startingBu
-- cap is being raised (no rows above 1000 today — confirmed by
-- `inspect-test.ts` runs in batch 10g testing).
-- =============================================================================

ALTER TABLE "characters" DROP CONSTRAINT IF EXISTS "characters_level_range_check";--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_level_min_check" CHECK ("characters"."level" >= 1);--> statement-breakpoint
ALTER TABLE "characters" DROP CONSTRAINT IF EXISTS "characters_bu_progression_check";--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_bu_progression_check" CHECK ("characters"."bu_spent" <= GREATEST("characters"."starting_bu", 25 + 10 * ("characters"."level" - 1) + 4 * ("characters"."level" / 4) * ("characters"."level" / 4 + 1) / 2) + "characters"."dm_bonus_bu");--> statement-breakpoint
ALTER TABLE "characters" DROP CONSTRAINT IF EXISTS "characters_starting_bu_check";--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_starting_bu_check" CHECK ("characters"."starting_bu" >= 0 AND "characters"."starting_bu" <= 100000);