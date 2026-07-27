# Phase 8.3 — Per-Instance Primitive Model

**Author:** Senku
**For:** Mashu — review & start of work
**Status:** Ready to start. v2 storage model locked.

---

## What we're building

Currently the bundle-expander **dedupes** primitives at write time — one row per `(character_id, primitive_id)`. That kills stacking because the engine never sees duplicates.

**Phase 8.3 goal:** allow multiple primitive instances per character so stacking rules (`stack`, `highest-only`, etc.) actually have something to stack. Three storage outcomes per primitive_id:

| Player action | Storage | BU | Effect |
|---------------|---------|-----|--------|
| **Inherited** (×N via heritage/cap/effect) | **1 row, collapsed** | 0 | 1× |
| **Direct + paid** (player adds to sheet, mirror unchecked) | **N rows, separate** | Full BU each | Stacks (2×, 3×, ...) |
| **Direct + mirrored** (player adds + checks mirror) | **1 row, links to inherited** | −buCost credit | Inherits baseline; flips sign |

**The "we only calculate it once but don't restrict" rule (Mashu 2026-07-27):** inherited sources ALWAYS collapse to 1 baseline instance, regardless of how many inheritance paths brought them. Direct additions are the ONLY way to multiply instances. The player explicitly says "I want a duplicate" by adding it directly.

---

## Why a migration

Current schema: `PRIMARY KEY (character_id, primitive_id)` on `character_primitives`. This enforces 1 row per character per primitive, which kills the model.

**Two options** (Mashu asked "why need migration?"):

| Option | What changes | Tradeoffs |
|--------|-------------|-----------|
| **(A) Schema migration** — drop PK, add `instance_id UUID`, partial unique indexes | Normalized, queryable, audit trail of every write | Migration risk, ~1 day of work + backfill script |
| **(B) JSON shadow column** — keep PK, add `instances JSONB` to `characters` table | No migration, fast to ship | JSON queries awkward, can't easily query "all instances of Vitality across all characters", debugging harder |

**Recommendation: (A) schema migration.** We have 1781 tests passing — the backfill can run in a transaction. The JSON approach creates a shadow schema that's harder to maintain as the engine grows. If you want speed over cleanliness, (B) is genuinely viable.

---

## Migration target schema

**File:** `0049_multi_instance_primitives.sql` (or whichever number is next; need to check migrations directory)

```sql
-- 1. Add instance_id to character_primitives
ALTER TABLE character_primitives
  ADD COLUMN instance_id UUID DEFAULT gen_random_uuid();

-- 2. Drop the existing PK
ALTER TABLE character_primitives
  DROP CONSTRAINT character_primitives_pk;

-- 3. Add partial unique indexes
-- Inherited rows: one per (character, primitive)
CREATE UNIQUE INDEX character_primitives_inherited_uniq
  ON character_primitives (character_id, primitive_id)
  WHERE origin_heritage_id IS NOT NULL
     OR origin_capability_id IS NOT NULL
     OR origin_effect_id IS NOT NULL;

-- Mirror rows: one per (character, primitive)
CREATE UNIQUE INDEX character_primitives_mirror_uniq
  ON character_primitives (character_id, primitive_id)
  WHERE is_mirrored = true AND origin_heritage_id IS NULL
     AND origin_capability_id IS NULL AND origin_effect_id IS NULL;

-- Direct-paid rows: NO unique constraint (multiple allowed)

-- 4. Backfill: every existing row gets its own instance_id (already done by DEFAULT)

-- 5. For data already in DB: existing rows are inherited-or-direct-original.
--    If they have origin_*, they're inherited (1 baseline per (char, prim)).
--    If they don't have origin_*, they were direct additions — keep them as direct-paid.
--    The partial unique indexes ensure this is consistent.
```

**Drizzle schema update** (`src/db/schema/characters.ts`):

```ts
// In characterPrimitives table definition, add:
instanceId: uuid("instance_id").defaultRandom().notNull(),

// Replace the primaryKey() with no PK; keep the indexes
```

**Bundle-expander stays mostly as-is** — it still dedupes inherited sources to 1 row per `(character, primitive_id)`. The change: now each "occurrence" in the modifier evaluation sees the full instance array, not just one.

---

## Direct-slot writes (modal store changes)

`character-modal-store.tsx` currently does upsert: if `(character_id, primitive_id)` exists, update it. That breaks the v2 model. New behavior:

- **Slot primitive directly, mirror unchecked** → INSERT new row with fresh `instance_id`, `is_mirrored = false`, no origin. Cost = +buCost.
- **Slot primitive directly, mirror checked** → INSERT new row, `is_mirrored = true`. If inherited row exists, this row links to it (via shared `primitive_id`); cost = −buCost. If no inherited row, this is a standalone negative instance; cost = −buCost.
- **Slot a heritage/capability/effect** → bundle-expander expands to inherited rows (already works; constraint now allows 1 row per (char, prim) inherited).

**UI behavior:** when player adds a primitive that's already inherited, show:
> "This primitive is already inherited from Lineage 'Ironborn'. Adding it directly costs 4 BU. [ ] Mirror this instead (−4 BU credit, links to inherited copy)"

If the player checks Mirror, the cost flips and the row is inserted as a mirror.

---

## Stacking engine wiring (no rewrite needed)

`src/lib/engine/modifiers.ts` already has all 6 stacking modes. The change: **the modifier collector receives the instance array per character**, not deduped primitives. Group modifiers by target, apply the stacking rule per modifier.

**API route `/api/characters/[id]` change:** return the full instance array (read = write shape). No dedup at read time.

**Modal store change:** already runs the modifier collector locally for the live preview. Extend it to handle multiple instances per primitive.

---

## Concrete batches

### 8.3a — Schema migration + Drizzle update (1 day)

- Write `0049_multi_instance_primitives.sql`
- Update Drizzle schema: add `instanceId`, drop PK, add partial unique indexes
- Generate migration
- Run migration locally, verify with `bunx drizzle-kit check`
- Backfill script: every existing row gets a fresh `instance_id` (DEFAULT handles this)
- **Tests:** add a regression test that asserts:
  - 1 row per (char, prim) where origin_*
  - 1 row per (char, prim) where is_mirrored = true AND no origin
  - N rows allowed for direct-paid (no UNIQUE constraint)

### 8.3b — Modal store reworked direct-slot writes (1.5 days)

- Replace upsert with insert (always creates new `instance_id`)
- Add `[x] Mirror` toggle UI on the direct-slot modal
- Detect inherited collision: if a primitive is already inherited (any row with origin_*), show the prompt about Mirror option
- Wire `is_mirrored` to write the row with the right flag
- **Tests:** add tests for:
  - Direct add of unowned primitive → new row, +buCost
  - Direct add of owned primitive (mirror unchecked) → new row, +buCost (stacks)
  - Direct add of owned primitive (mirror checked) → new row, −buCost (links to inherited)
  - Multiple direct adds of same primitive → multiple rows, each +buCost, total stacks

### 8.3c — Stacking engine receives instance array (2 days)

- API route `/api/characters/[id]`: return instance array, not deduped primitives
- Modal store: extend local modifier collector to handle multiple instances
- Sheet display: show modifier breakdown showing each instance separately
- `evaluateModifiers` already supports all 6 stacking modes; just ensure it's called with the right input shape
- **Tests:** add tests for each stacking rule with multiple instances:
  - `stack` with 4 instances of +10 → +40
  - `highest-only` with 4 instances of +10 → +10
  - `lowest-only` with [+10, +5] → +5
  - `unique-by-primitive` with 4 same primitive_id → +10
  - `unique-by-target` with 4 modifiers targeting vitality → first wins
  - `replace` with heritage < capability < direct (direct wins)

### 8.3d — `<ConditionBadges>` drop-in (0.5 day)

- Component exists at `src/components/library/condition-badges.tsx`
- Wire into character sheet (each primitive card shows its condition badges)
- No new logic — just placement

### 8.3e — Multi-instance UI in Capabilities tab (1 day)

- Show each direct-paid instance as a separate card
- Each card has its own origin badge (or "Direct" badge)
- "Add another copy" button on direct-paid primitives (each click → new row, costs full BU)
- Mirror toggle button on each direct card

---

## Total: 6 working days

| Day | Work |
|-----|------|
| Day 1 | 8.3a — migration |
| Day 2-3 | 8.3b — modal store |
| Day 4-5 | 8.3c — stacking engine |
| Day 6 | 8.3d (0.5) + 8.3e (1, spans Day 6-7) |
| Day 7 | Buffer / regression |

---

## Code-path comments (per Mashu 2026-07-27)

Where the dual code paths exist (modal-side resolver vs server-side resolver), I'll add comments like:

```ts
/**
 * NOTE: This is the modal-side live preview resolver. It must stay in sync
 * with the server-side resolver in /api/characters/[id]/route.ts.
 * If you change one, change the other. Both call evaluateModifiers()
 * over the instance array with the same stacking rules.
 */
```

---

## What I'm NOT building in 8.3

- Conditions (Phase 8.4)
- Sheet interactive UI (Phase 8.4) — except ConditionBadges drop-in
- Collections (Phase 8.5)
- Share + Follow (Phase 8.6)

These stay scoped to their respective phases.

---

## Sign-off

Mashu: confirm (A) schema migration is OK, and I'll start 8.3a tomorrow.

If you want (B) JSON shadow column instead, say so — I'll write that plan up instead.