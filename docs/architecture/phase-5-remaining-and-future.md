# SwordWeave — Final Phase 5 To-Do + Future Phases

> **Status snapshot (2026-07-08):** Phases 1-4 shipped + Phase 5 partially shipped.
> This document is the SINGLE SOURCE OF TRUTH for what remains.
> Do not start new work without consulting this list first.

---

## Phase 5 — what is already SHIPPED (do not redo)

✅ **Wire `version_id` + `slot_source` on character slot-add**
- POST `/api/characters`, PATCH `/api/characters/[id]`, POST `/api/characters/[id]/clone`
- Migration 0025 backfilled 10 existing slots to `slot_source='PINNED'`

✅ **`SlotSourceBadge` component** (`src/components/characters/slot-source-badge.tsx`)
- 3 colors: green=Owned, purple=Forked, blue=Pinned
- Auto-detects staleness: "v1 → v2" sublabel when source has newer version

✅ **Bulk `latestVersionId` loader** in `src/app/characters/[id]/page.tsx`
- One query for all slotted entities, no N+1

✅ **CapabilitiesTab + ItemsTab render badges**

✅ **Migration 0024** — unique `(entity_id, version_number)` index on all 5 `*_versions` tables
- Fixes 42P10 error that was hiding the 22P02 Clerk→UUID bug

✅ **`recordVersion` resolves Clerk text userId to internal UUID** before insert
- Fixes 22P02 invalid_text_representation

✅ **Tests: 483/483 passing. tsc clean. Build clean. Vercel `age: 0` deployed.**

✅ **Version history page** at `/library/item/[id]/versions`
- Shows all versions chronologically (FULL vs DELTA badge, latest indicator)
- Each row has "Slot vN into build sandbox" link → opens `/sandbox/grammar` or `/sandbox/blueprint` with `?version=N` pre-filled
- Click row to expand reconstructed payload

✅ **"View history" link** in `creations-client.tsx:465` and `library-item-preview.tsx`

---

## Phase 5 — what is REMAINING (the real finish line)

### 🔴 MUST DO to close Phase 5

#### P5R-1: Lineage UI works for forks that exist in `source_origin` AND for forks recorded in the `forks` engagement table

**Current bug:** `src/lib/publishing/fork-lineage.ts:getForkSource()` only reads from the `forks` engagement table. It ignores `entity.source_origin = "fork:<id>"`. So:
- Primitive 476 has `source_origin = "fork:25"` (real fork marker) but NO `forks` row → no lineage shown
- Primitive 471 has "(fork)" in its name but no `source_origin` marker and no `forks` row → no lineage shown (correct — there's no recorded parent)

**Fix:**
- `getForkSource(targetType, targetId)` returns the parent. Currently reads only `forks` table. ALSO check `targetEntity.source_origin` for `fork:<TYPE>:<id>` pattern, fall back to that if no `forks` row exists.
- Format normalization: change `source_origin = "fork:25"` to `source_origin = "fork:PRIMITIVE:25"` so the parser can dispatch by type.
- One-shot migration to normalize all existing `source_origin` values to the `<TYPE>:<id>` form.

**Files to touch:**
- `src/lib/publishing/fork-lineage.ts` — add `source_origin` fallback
- New migration: `0026_normalize_source_origin_fork_format.sql`
- New script: `scripts/normalize-fork-source-origin.mts`

**Effort:** 0.5 day

---

#### P5R-2: Backfill `forks` engagement table from existing data

**Current state:** 18 rows in `forks` table. ~190+ forks are invisible because they were created before the engagement system existed (they have `(fork)` in their name but no `forks` row).

**Fix:** One-shot script that:
1. For every entity where `source_origin LIKE 'fork:%'` (after P5R-1 normalization), INSERT a row into the `forks` table with the parsed parent.
2. For every entity where `name LIKE '%(fork)'` but no `forks` row exists AND no `source_origin` — these are un-typed forks. Mark them somehow (maybe a `needs_attention` column, or just leave the name as the only signal).

**Files:**
- New script: `scripts/backfill-forks-engagement.mts`
- Run once, then no migration needed (the `forks` table is the destination).

**Effort:** 0.5 day

---

#### P5R-3: Lineage UI shows BOTH directions on entity pages

**Current state:** `FlagAndForkFooter` shows "Forked from" breadcrumb (one direction). `ForksList` component exists but I need to verify it's actually rendered on the entity page.

**Required:**
- ✅ On a fork: "Forked from [name]" with link (likely already works, needs verification)
- ❌ On any entity: "N forks of this" with list of forks (need to verify `ForksList` is wired into the page, not just imported)
- ❌ Visibility filter: only show PUBLIC forks + MINE + FOLLOWERS (per `FINAL visibility model`)

**Files:**
- `src/app/library/item/[id]/page.tsx` — verify `<ForksList />` is rendered as a sibling
- `src/components/engagement/forks-list.tsx` (or `forks-list-client.tsx`) — verify visibility filter

**Effort:** 0.5 day (mostly verification + visibility filter)

---

#### P5R-4: BU cost per version in the version history list

**Current state:** The version history page (`/library/item/[id]/versions/page.tsx`) shows: version #, FULL/DELTA badge, latest indicator, author, date. Does NOT show BU cost.

**Fix:** Add a "BU cost" column to each version row. The cost is in the snapshot JSON at `buyPrice` (per `live-schema.md`). Read from `version.snapshot.buyPrice` (or `complexityPrice` — verify the field name in the live schema).

**Files:**
- `src/app/library/item/[id]/versions/page.tsx` — add BU column to `VersionRow`

**Effort:** 0.25 day (after verifying the snapshot field name)

---

#### P5R-5: Restore endpoint (POST to create new version from old snapshot)

**Current state:** No `/api/[entity]/[id]/restore` endpoint exists. Verified via grep — zero references to `restore` in the API routes.

**Fix:** Add `POST /api/[type]/[id]/restore` that:
1. Accepts `{ versionId: string }` (or `versionNumber: number`)
2. Loads the requested version's snapshot
3. Writes a new version of the entity (FULL snapshot, is_latest=true) with the OLD content
4. The current latest is superseded (is_latest=false, superseded_at=now)
5. The entity's live row is updated to match (so the page reflects the restored content immediately)

Then add a "Restore" button to the version history page that calls this endpoint.

**Files:**
- New route: `src/app/api/primitives/[id]/restore/route.ts` (+ 4 more for capability, effect, item, template)
- OR a unified: `src/app/api/versions/restore/route.ts` that takes type+id+version
- `src/lib/versions/restore-version.ts` — the service function
- `src/app/library/item/[id]/versions/page.tsx` — add Restore button to `VersionRow`

**Effort:** 0.5 day

---

#### P5R-6: List view in Creations (in addition to grid)

**Current state:** `creations-client.tsx` renders a `LibraryTable` grid only. No view toggle.

**Fix:** Add a view-mode toggle (Grid / List) that switches between the existing grid and a denser table view (rows = single line, more entries per page).

**Files:**
- `src/app/creations/creations-client.tsx` — add view-mode state + toggle UI + list view component

**Effort:** 0.25 day

---

#### P5R-7: Re-create the Clerk test account (BLOCKED for 3+ sessions)

**Current state:** The test account at `.swordweave-test-account.local` references a Clerk account that no longer exists. Clerk says "Couldn't find your account." This blocks ALL live UI E2E verification. **Mashu must do this in the Clerk dashboard** (10 min).

**Action items for Mashu:**
1. Log into Clerk dashboard
2. Create a new test user with email `xeun+test@<domain>` (or whatever was used before)
3. Save the new credentials to `.swordweave-test-account.local`

**Effort:** 10 min (Mashu), then all future "live UI verification" steps become possible.

---

#### P5R-8: Make the diff page discoverable (Mashu 2026-07-08)

**Current state:** The diff page **already exists** at `/library/item/<TYPE>:<id>/versions/compare?from=N&to=M` (per `src/app/library/item/[id]/versions/compare/page.tsx`). The only entry point is a small per-row "Compare with v[N-1]" link on the version history page, which is easy to miss (Mashu: "I have diff page? Maybe but I don't have a way to access it.").

**Fix:** Add a "Compare latest two versions →" header link on the version history page that auto-navigates to `?from=<latest-1>&to=<latest>`. Also: highlight the inline compare button so it doesn't get lost in the row.

**Files:**
- `src/app/library/item/[id]/versions/page.tsx` — add header link + make inline button more prominent

**Effort:** 0.1 day (5 min)

---

### Phase 5 REMAINDER — Total Effort

**~3 days** of focused work for Senku (items P5R-1 through P5R-6, plus 5 min for P5R-8). Plus **10 min** for Mashu to fix P5R-7.

**After P5R-1 through P5R-6 + P5R-8 ship:** Phase 5 is genuinely done. Versioning + forking works end-to-end for the user.

---

## Phase 6 — Build Cost Calculation Engine + Budget Enforcement (Mashu 2026-07-08)

**Scope:**

The user (DM or character builder) needs to know the total BU cost of a character build before committing. Today, BU prices are stored per-entity but never summed. We need:

1. **Schema: per-character `bu_budget` cap** (nullable, default null = no cap)
   - New migration `0027_phase6_character_bu_budget.sql`
   - New column on `characters` table: `bu_budget integer NULL` (NULL = no enforcement)
   - Add to schema in `src/db/schema/characters.ts`

2. **Cost computation service** — given a character, sum the BU costs of all slotted entities based on the pinned version (not the live version).
   - Slots: primitive + capability + item (and maybe template-derived things for race/background/archetype)
   - Each slot has `version_id` (from Phase 5 wiring) — use that to look up the snapshot's `buyPrice`/`complexityPrice`
   - If `version_id` is null, fall back to the entity's live row

3. **Display on character sheet** — "Total: 47 BU / cap 60 BU" with breakdown tooltip ("Strike v2: 8 BU, Aura Detective: 5 BU, ...")
   - If `bu_budget` is set AND total > budget: show RED warning
   - If no cap: just show total

4. **"What would this cost" preview** in the build form when adding a slot — show "+8 BU" before confirming

5. **Enforcement at character save** (per Mashu 2026-07-08 — IN SCOPE):
   - On POST `/api/characters` and PATCH `/api/characters/[id]`: if the character has `bu_budget` set, validate that the new total ≤ budget
   - If over budget: return 422 with `{ code: "OVER_BUDGET", total, budget, breakdown }` so the client can show an error
   - Allow override: a `?force=true` query param or a "Save anyway" UI button for the rare case where the DM explicitly wants to exceed

6. **"Set budget" UI** on the character sheet — a small input field that saves `bu_budget` to the character
   - Inline edit, no separate page

**Files (estimated):**
- New migration: `src/db/migrations/0027_phase6_character_bu_budget.sql`
- `src/db/migrations/meta/_journal.json` — add idx 27
- `src/db/schema/characters.ts` — add `buBudget` column
- `src/lib/build-cost/compute-build-cost.ts` — service
- `src/lib/build-cost/__tests__/compute-build-cost.test.ts` — unit tests
- `src/components/characters/build-cost-summary.tsx` — display
- `src/components/characters/set-bu-budget.tsx` — input
- `src/app/characters/[id]/page.tsx` — add summary section + budget input
- `src/app/sandbox/builds/page.tsx` — add live preview
- `src/app/api/characters/route.ts` — add 422 on over-budget
- `src/app/api/characters/[id]/route.ts` — same on PATCH

**Effort:** 2-3 days (includes budget enforcement wiring)

**Risk:** If BU prices haven't been set on most entities yet, the calculation will return 0/empty and not be useful. May need a Phase 6 prerequisite: "ensure every primitive/capability/item has a `buyPrice` set, default to 0 for unpriced entities, show 'unpriced' badge." I'll surface this on day 1 and decide with Mashu.

---

## Phase 7+ — Future Work (per Mashu 2026-07-08)

### Phase 7: DB Revise + Content Cleanup

**Scope:**
- **Delete all forks NOT owned by Mashu** (keep only official/system content + Mashu's own content)
- **Rewrite races, backgrounds, archetypes** with better design (currently from Notion Blueprint Ledger import)
- **Migrate legacy entities** that don't fit the new data model (e.g. primitives with NULL `buyPrice`, items with missing required fields)
- **Normalize tags + categories** — currently freeform strings
- **Fix the `source_origin` data quality** — many entities have legacy formats that don't match the spec

**Why before anything else:** Phase 8 (unified search) and Phase 9 (character creation UX) both depend on clean, well-tagged data. Building search on dirty data means the search returns bad results.

**Effort:** 3-5 days (mostly manual content work + a few data migrations)

**Risk:** HIGH. Deleting content is destructive. Must use soft-delete + a recovery window. Mashu must approve each deletion batch.

---

### Phase 8: Unified Performant Filtering/Search System

**Scope:**
- **One search bar** that works across characters, templates, builds, grammar, creations, library
- **Per-page filter conditions** (e.g. library: by entity type + tag + visibility; characters: by level + race + total cost)
- **Backend:** unified search endpoint with cursor-based pagination, indexed columns, possibly a search-specific table
- **Frontend:** debounced input, result type tabs, saved searches

**Why this matters:** Right now, every page has its own ad-hoc filter. The user said: "we have basically the same things to search through and based on the same things everywhere" — that's the case for unification.

**Effort:** 5-8 days (significant — this is essentially a search subsystem)

**Prerequisite:** Phase 7 (clean data) must be done first. Searching dirty data is wasted work.

---

### Phase 9: Better Character Creation Flow + Grammar/Template Element Build Modal UX

**Scope (TBD, requires more scoping from Mashu):**
- New step-by-step character creation wizard
- Better grammar/template element pickers (currently modal-heavy)
- Real-time BU cost preview (depends on Phase 6)
- Drag-and-drop slot rearrangement

**Effort:** 5-10 days

**Prerequisite:** Phase 6 (cost engine) and Phase 7 (clean data) should be done.

---

## Summary Table

| Phase | Status | Effort | Prerequisites |
|---|---|---|---|
| 1-4 | ✅ Shipped | — | — |
| 5 (partial) | 🟡 Mostly shipped | — | — |
| **5 REMAINDER (P5R-1 to P5R-8)** | ⏳ Not started | **~3 days + 10 min Mashu** | — |
| 6 (Build Cost Engine + Budget Enforcement) | ⏳ Not started | 2-3 days | — |
| 7 (DB Revise + Content Cleanup) | ⏳ Not started | 3-5 days | — |
| 8 (Unified Search) | ⏳ Not started | 5-8 days | Phase 7 |
| 9 (Character Creation UX) | ⏳ Not started | 5-10 days | Phase 6, 7 |

---

## What I (Senku) need from Mashu RIGHT NOW to unblock

1. **P5R-7: Re-create the Clerk test account.** This unblocks live UI E2E verification for everything from this point forward. 10 minutes in the Clerk dashboard.
2. **Approval to start P5R-1 through P5R-6 + P5R-8** as one batch (~3 days of work, with checkpoints after P5R-1+2, P5R-3, P5R-4+5, P5R-6+8).
3. ✅ **Phase 6 budget enforcement: APPROVED (Mashu 2026-07-08).** Schema migration `0027_phase6_character_bu_budget.sql` is now in scope. Effort bumped to 2-3 days.

Ten billion percent — once you confirm those, I can start.

---

*Last updated: 2026-07-08. Single source of truth. Updates to this doc must be in this file, not in scattered messages.*
