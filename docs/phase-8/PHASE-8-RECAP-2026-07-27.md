# Phase 8 → 8.5 — Recap (2026-07-27)

**Author:** Senku (recap after `message.txt`)
**For:** Mashu — review & scheduling
**Status:** Mashu's 2026-07-27 message.txt locked the dedup architecture. Phase numbering re-split to match what we've actually shipped. Open questions stripped of jargon for Mashu's review.

---

## Phase Numbering (re-split, v3 per Mashu 2026-07-27 feedback)

| Phase | Scope | Status |
|-------|-------|--------|
| **Phase 8.1** — Character creation modal | Tabbed modal for new + edit characters | ✅ Shipped |
| **Phase 8.2** — BU math + carry-over + mobile fixes | The last batch we just landed (`13b23ac`) | ✅ Shipped |
| **Phase 8.3** — Per-instance primitive model | v2 storage model from `message.txt` + stacking | 🔨 **6 days, next** |
| **Phase 8.4** — Conditions + sheet live UI | Conditions composer/runtime + interactive sheet | 📅 After 8.3 |
| **Phase 8.5** — Collections | "Playlists" for primitives/heritages/capabilities | 📅 After 8.4 |
| **Phase 8.6** — Share + Follow | Copy-link sharing + follow lists | 📅 After 8.5 |

The order is now: **primitive flattening (8.3) → conditions + sheet interactive (8.4) → collections (8.5) → share+follow (8.6)**.

### Phase 8.4 detail (Conditions + Sheet UI)

**Conditions** — user-authored, runtime-applied, not hardcoded:
- Condition = `{ tag: string, description?: string, modifiers?: Modifier[], isActive: boolean }`
- Players type a tag at runtime: `poisoned`, `prone`, `stunned`, or `poisoned −2 attack rolls`
- If the tag carries modifiers, they apply to the character when the condition is active
- If not, it's a visible note only (cosmetic)
- Players can deactivate conditions (visible but don't apply) or delete them
- Accordion on character sheet with cards for each condition
- **No library required** — conditions are freeform strings, not entries from a `conditions` table. Avoids over-engineering per Mashu's 2026-07-27 note.

**Sheet live UI** — interactive primitives:
- Click a primitive → see its tags/ops/modifiers expanded
- Mirror toggle works in real-time (not just at save)
- Active/inactive toggle on capabilities (infrastructure already in `character_capabilities.isActive`)
- Behavior references resolve live (e.g., `blockValue` from primitive shows current value in capability card)

---

## TL;DR

- **Phase 8.1 + 8.2 (Character Creation Modal + BU math):** the modal-based creation flow is **live** and works end-to-end. The biggest design deviation from the original plan: we shipped a **single tabbed UI** for both new and edit modes instead of the planned stepped wizard (Mode A) + tabbed editor (Mode B). Pragmatic simplification that worked.
- **Phase 8.3 (Per-Instance Primitives):** next batch of work. Currently stacking modifiers from primitive duplicates don't actually stack because the bundle-expander dedupes primitives at write time. Per Mashu's 2026-07-27 message.txt the architecture flips this — see "v2 Storage Model" below.
- **Phase 8.5:** not started. Collections schema doesn't exist; `sourceOrigin` is still a freeform string; share-with-link and follow-list-views are in the schema but no UI.

---

## v2 Storage Model (per Mashu 2026-07-27 message.txt)

The 3 storage outcomes from a single primitive_id:

| Action | Storage | BU | Effect |
|--------|---------|-----|--------|
| **Inherited** (×N from heritage/capability/effect) | **1 row, collapsed** | 0 | 1× |
| **Direct + paid** (player adds to sheet, mirror unchecked) | **N rows, separate** | Full BU each | Stacks (2×, 3×, …) |
| **Direct + mirrored** (player adds + checks mirror) | **1 row, links to inherited** | −BU credit | Inherits baseline; flips sign |

**Schema implication:** the existing PK `(character_id, primitive_id)` must change. New shape:

- One **inherited** row per `(character_id, primitive_id)` where `origin_* IS NOT NULL` — collapses all inheritance paths
- One **mirror** row per `(character_id, primitive_id)` where `origin IS NULL AND is_mirrored = true`
- **N direct-paid** rows per `(character_id, primitive_id)` where `origin IS NULL AND is_mirrored = false` — each is a separate stack

**Concretely:**
- Drop PK `(character_id, primitive_id)`
- Add `instance_id UUID defaultRandom()` — surrogate key for direct-paid rows
- Add partial unique indexes:
  - `UNIQUE (character_id, primitive_id) WHERE origin_heritage_id IS NOT NULL OR origin_capability_id IS NOT NULL OR origin_effect_id IS NOT NULL`
  - `UNIQUE (character_id, primitive_id) WHERE origin IS NULL AND is_mirrored = true`
- Direct-paid rows have no UNIQUE constraint — multiple allowed

**Mirror logic at the engine layer:**
- When player slots a primitive directly with `is_mirrored = true`:
  - Check if inherited row exists for this `(character, primitive_id)`
  - If yes → mirror row links to it; cost = −buCost (credit)
  - If no → mirror row is a standalone negative instance; cost = −buCost (credit)
- When player slots a primitive directly with `is_mirrored = false`:
  - Cost = +buCost (pay full)
  - Each is a separate direct-paid instance (N rows allowed)
  - Stacks via modifier engine's `stacking: "stack"` rule

**Stacking engine receives the post-storage array** of primitive instances per character. For each target (e.g. `max-vitality`), it groups by primitive_id, looks up the stacking rule on the modifier, and resolves per `stack` / `highest-only` / `lowest-only` / `unique-by-primitive` / `unique-by-target` / `replace`. The author writes the stacking rule per modifier — players don't pick.

---

## Behavior Block References (per Mashu 2026-07-27 followup)

**Use case:** Author defines a behavior in a primitive with a named modifier slot:
```
Primitive "Defender":
  behaviors:
    block: { modifier: 6, name: "blockValue" }
```

Then a capability references it by name:
```
Capability "Shield Wall":
  description: "While active, reduces damage taken by blockValue."
  activeBehavior: "block"
```

When the capability is toggled **active**, the engine looks up `blockValue` (currently `6`) from the referenced primitive and applies `damage taken − 6`. When toggled **inactive**, the modifier doesn't apply.

**Infrastructure already in place:**
- `behavior` token type exists in `equations.ts` (line 170: `{ kind: "behavior", name: string }`)
- `isActive` column exists on `character_capabilities` (`entities.ts` line 62, default `true`)
- `capability_toggle` log event exists for tracking toggles in the character log

**Phase 8.4 work (sheet live UI):**
- Resolve behavior references live in the capability card (show "While active: damage − blockValue (currently 6)")
- Active/inactive toggle button on capability cards in the sheet
- Mirror toggle on primitive cards (also live, not just at save)
- Click primitive → expand to see tags/ops/modifiers/behavior slots

**Phase 8.4 work (conditions):**
- New table `character_conditions` (id, character_id, tag, description?, modifiers?, is_active, sort_order, created_at)
- "Add condition" button on character sheet — opens small composer (tag input + optional description + optional modifier expression)
- Accordion on sheet listing all conditions as cards
- Each card: tag name, description text, modifier breakdown, active toggle, delete button
- Parser handles patterns like `poisoned −2 attack rolls` (extract modifier if present, else treat as cosmetic only)

---

## What's Done — Phase 8 (Character Creation Modal)

### Built and shipped (`bf703e9`, `13b23ac`, and earlier 8.2 batches)

**Architecture**
- ✅ FAB-launched persistent modal via `Mona Lisa` icon — opens from anywhere in `/atelier`
- ✅ React Context store (`character-modal-store.tsx`) — survives navigation, not URL-bound
- ✅ Edit-mode decoupled from modal visibility (`editSessionActive` flag, batch 9)
- ✅ Navigation guard for unsaved changes (`UnsavedChangesModal`, in-app, not `window.confirm`)
- ✅ Edit-mode race condition fixed (`openForSlot → setIsOpen(true)`, no `open()` reset)
- ✅ Auto-save draft to localStorage every 5s
- ✅ Server is source of truth; local draft merges on modal open

**UI**
- ✅ Tabbed layout with: Identity, Attributes, Lineage, Upbringing, Manifest, Backstory, Items, Notes
- ✅ Live BU footer with carry-over math: `BU X/Y (+N), BU DEBT X/Y (max Z BU)` (batch 19)
- ✅ Mobile-first layout: stats wrap inside their bubble, Save/Create button anchored right
- ✅ Block-comment-as-text bug fixed (proper JSX comments now)
- ✅ `slot-receiver-tab.tsx` for picking primitives/capabilities/items from the library
- ✅ Capabilities tab restructured: two accordions (All Primitives by origin + Capabilities by Style A/B/C)
- ✅ Preview modal matches atelier: fetches full capability from `/api/capabilities/[id]` on card click
- ✅ Backstory tab: 4 fields (origin/motivation/ties/flaw) editable via modal
- ✅ Preview button: opens in modal, not new tab

**Engine integration**
- ✅ Bundle-expander (`bundle-expander.ts`): flattens heritage/capability/effect chains into `character_primitives` rows with origin metadata
- ✅ BU formula (`bu.ts`): `cumulativeBuForLevel`, `maxBuDebtForLevel`, `summarizeSlotBu`, mirror credit
- ✅ Eager bundle preload on edit (no waiting for tab clicks)
- ✅ BU over-budget = soft warning (constraint dropped from DB in batch 13)
- ✅ `buBudget: null` correctly treated as not-provided (no more `Number(null) = 0` bug)

### Done but not exercised end-to-end

- ⚠️ **Stack resolver (`evaluateModifiers` in `modifiers.ts`):** supports all 5 stacking modes (`stack`, `highest-only`, `lowest-only`, `unique-by-primitive`, `unique-by-target`, `replace`) BUT **never sees more than one instance of the same primitive** because the bundle-expander collapses duplicates. The engine is ready; the input it's fed is pre-deduped.

---

## What's Done — Phase 8 (Character Sheet)

### Built (`character-sheet-view.tsx`, 2434 lines)

- ✅ 6 tabs: Overview · Capabilities · Items · Backstory · Notes · History
- ✅ VitalityTracker rendered at top
- ✅ PB card on Overview (lvl + proficiency + bonus)
- ✅ DM Bonus inline editor
- ✅ Unified `BuBudgetFooter` (budget + debt + remaining, with exceeded-by-X feedback)
- ✅ Capabilities tab: ALL primitives accordion (grouped by origin: heritage/capability/direct) + Capabilities by Style A/B/C accordion
- ✅ BackstoryTab with modal editor
- ✅ History tab (audit log)
- ✅ Item equip/toggle UI

### NOT built (gaps from your `message.txt` spec)

- ❌ **`<ConditionBadges>` not dropped into the sheet.** Component exists at `src/components/library/condition-badges.tsx` (90 lines), built in Phase 7. Drop-in is a 30-min job.
- ❌ **Stacked primitives don't stack.** If you slot Vitality Augment I four times (direct, via heritage, via capability, via effect-in-capability-in-heritage), the sheet sees ONE row, not four. The engine has the resolver but the input is already collapsed.
- ❌ **Per-instance origin display.** Sheet shows "from Lineage 'Elf'" or "from capability 'Aegis Shield'" but doesn't distinguish multiple copies.
- ❌ **Live condition evaluator (HP threshold auto-detection, narrative flag, mirror badge).** Not started. `evaluateCondition()` returns `true` for v1 conditions — engine is a no-op for v1.

---

## What's Left — Phase 8 (per your `message.txt`)

Your `message.txt` describes a clean **3-phase pipeline**:

```
[ Phase 1: Aggregation ]  →  [ Phase 2: Economy & Debt ]  →  [ Phase 3: Modifier Engine ]
  Flatten all sources          Dedupe BU costs & Mirrored    Apply Stacking Rules
  into instance tokens         allowances per Primitive ID   per Target/Modifier
```

### What exists today vs what you want

| Phase | Today | You want | Gap |
|-------|-------|----------|-----|
| **1. Aggregation** | Bundle-expander collapses duplicates at write time → 1 row per primitive | Keep all instances (multiple rows per primitive, each with origin metadata) | **Decouple dedup from write** |
| **2. Economy & Debt** | BU cost paid per primitive row (with mirror credit) | Pay BU ONCE per primitive_id; mirror toggles give back BU equal to cost | **Dedupe at the BU calculation layer**, not at storage |
| **3. Modifier Engine** | `evaluateModifiers` supports all stacking modes — but never sees >1 instance of same primitive | Resolve modifiers via stacking rules; mirror flips per-operation | **Already done; just needs Phase 1 to feed it multiple instances** |

### Concrete changes needed (per v2 model)

1. **Schema migration:** drop PK `(character_id, primitive_id)`. Add `instance_id UUID defaultRandom()`. Add partial unique indexes:
   - One inherited row per `(character_id, primitive_id)` (where `origin_*` set)
   - One mirror row per `(character_id, primitive_id)` (where `origin IS NULL AND is_mirrored = true`)
   - Multiple direct-paid rows allowed (no unique constraint)
   - Migration: `0048_multi_instance_primitives.sql`

2. **Bundle-expander stays mostly as-is** for inheritance (collapses to 1 row per primitive_id, picks most-specific origin). The change: now emits 1 row per inheritance, period.

3. **Direct slot writes get reworked:**
   - `character-modal-store.tsx`: when user slots a primitive directly, write a NEW row (not update existing). Each direct slot is a separate insert with a fresh `instance_id`.
   - Player toggle `[x] Mirror` on the slot → write as `is_mirrored = true`. The cost flips to `−buCost` (credit).
   - UI shows: "This primitive is already inherited from Lineage 'Ironborn'. Adding it directly costs 4 BU. [ ] Mirror this instead (−4 BU credit, links to inherited copy)"

4. **Stacking engine wiring:**
   - `evaluateModifiers` already supports all 6 stacking modes — needs the per-instance data, not the deduped data
   - API route `/api/characters/[id]` returns the **full instance array** (no dedup at read time either — read = write shape)
   - `sheet.ts` (or a new `instance-resolver.ts`) iterates instances per target, applies stacking rule per modifier

5. **Character sheet UI:**
   - Multiple instances of same primitive display as separate cards in the Capabilities tab, each with its own origin badge (or "Direct, mirror" badge if mirrored)
   - `<ConditionBadges>` drop-in on each card showing active/narrative/mirrored status
   - Sheet shows the **resolved value** for each stat (vitality, PB, awareness) alongside the modifier stack that produced it
   - "Add another copy" button on direct-paid primitives (each click → new row, costs full BU)

### Scope estimate

This is a **substantial refactor** of the schema + bundle-expander + modal store + API + sheet. Realistic split:

- **8.3a — Schema migration + bundle-expander stays-as-is** (1 day)
- **8.3b — Modal store: reworked direct-slot writes with mirror toggle** (1.5 days)
- **8.3c — Stacking engine: instance array flow + sheet wiring** (2 days)
- **8.3d — `<ConditionBadges>` drop-in on sheet** (0.5 day)
- **8.3e — Multi-instance UI in Capabilities tab + "add another copy" button** (1 day)

Total: **6 days** of focused work.

---

## What's Left — Phase 8.5 (per your message)

From your message:

> *"we will have to recap and schedule the other things mainly the collections (so in creating a heritage or mechanic we have the 'Source origin' which is text, but will be a dropdown from existing collections or creating anew one. So in a collection we will have all the things for a campaign or world or a specific thing, people decide) and the condition evaluator, the Token Resolution Engine and the and how we display these (basically where does something increase/decrease the numbers on the character sheet, how tags, operations and mirroring translate into character sheet, and how we display conditions tags and stuff like vulnerabilities, languages, etc."*

> *"we will not do some scalars for casting in character sheet. We already have for capabilities toggle for active/inactive and triggering."*

### Three tracks

**Track A — Collections system** (Phase 8.5 core)
- New schema: `collections` table (id, name, owner_id, visibility, kind: CAMPAIGN|WORLD|PERSONAL)
- New schema: `collection_items` (collection_id, entity_type, entity_id) — polymorphic join
- API: CRUD for collections, follow-collection (different from follow-user)
- UI: collection picker in all composer forms (`build-composer`, `capability-composer`, `item-composer`, `template-composer`, `primitive-registry`)
- Replaces `sourceOrigin: string | null` with `sourceCollectionId: uuid | null` (+ freeform fallback for "ad-hoc" origin)
- Default collections per user: `my pure creations` / `forked` / `favorites from community` (auto-populated)

**Track B — Condition evaluator v1** (Phase 8.5)
- Implement `evaluateCondition` for v1 conditions instead of always returning `true`
- Auto-trackable whitelist: `target-below-half-hp`, `target-below-quarter-hp`, `target-is-prone`, etc. (need to enumerate)
- Narrative conditions: display-only, always gray
- Wire into the modifier pipeline so active/inactive flips propagate
- Display active state in `<ConditionBadges>` (green for active, gray for narrative, amber for inactive)
- Estimate: **3–4 days**

**Track C — Sheet live UI for tags/ops/mirror/conditions** (Phase 8.5)
- The sheet currently shows pre-resolved numbers; doesn't show *why* (which modifiers contributed)
- New band on each stat: "Sources" — collapsible list of modifier instances contributing, with mirror badge + condition badge + origin path
- Token Resolution Engine: conceptual for v1; defer implementation
- Estimate: **3–5 days** (depending on scope)

**Track D — Share + follow lists** (Phase 8.5)
- `follows` table already exists (`profiles.ts`)
- Share-with-link: generate signed URL for read-only source page view
- Profile page: 3 default collections (own / forked / favorited)
- Search/filter improvements keyed off collections
- Estimate: **4–5 days**

---

## Proposed Schedule

**Phase 8.3 — Per-instance primitive model (6 days)**

```
Week 1 (Aug 4–8):
  Mon:       8.3a — Schema migration + bundle-expander stays as-is for inheritance
  Tue–Wed:   8.3b — Modal store: reworked direct-slot writes with mirror toggle
  Thu–Fri:   8.3c — Stacking engine: instance array flow + sheet wiring

Week 2 (Aug 11–15):
  Mon:       8.3d — <ConditionBadges> drop-in on sheet
  Tue–Wed:   8.3e — Multi-instance UI in Capabilities tab + "add another copy" button
  Thu:       Buffer / regression catches
  Fri:       → Phase 8.3 closed by Aug 15
```

**Phase 8.4 — Sheet live UI (~4–5 days)**
Track C from above: click primitive → see tags/ops live; mirror toggle works in real-time; conditions show real effects.

**Phase 8.5 — Collections + Share + Follow + Conditions (~12–14 days)**
Order: B (conditions) → A (collections) → D (share + follow). Or swap if you prefer.

---

## Open Questions (status as of 2026-07-27)

### Q1: Phase 8.3 engine math location — ✅ **RESOLVED: C (hybrid)**

- **Server resolves** for the public character sheet (authoritative, what others see when shared)
- **Browser resolves** inside the edit modal for live preview (PB, vitality, attributes, 10 practices, condition tags)
- The modal store already runs live math locally — we keep that
- No rewrite needed; we're extending what's already there

### Q2: Phase 8.5 priority — ✅ **RESOLVED: B → A → D** (now B is part of 8.4)

Per Mashu 2026-07-27: conditions belong in 8.4 (with sheet UI), not 8.5. Collections move to 8.5. Share/Follow move to 8.6.

### Q3: Share-with-link scope — ✅ **RESOLVED: copy-link only (no collaborator permissions)**

No editable-for-others mode. Player copies a link, recipient opens it read-only. Simpler, no permissions UI to build.

---

## All open questions resolved. Ready to start Phase 8.3.

Phase 8.3 plan (the v2 storage model from `message.txt`):

```
Week 1 (Aug 4–8):
  Mon:       8.3a — Schema migration (drop PK, add instance_id, partial unique indexes)
  Tue–Wed:   8.3b — Modal store: direct-slot writes with mirror toggle
  Thu–Fri:   8.3c — Stacking engine: instance array flow + sheet wiring

Week 2 (Aug 11–15):
  Mon:       8.3d — <ConditionBadges> drop-in on sheet (component already exists)
  Tue–Wed:   8.3e — Multi-instance UI in Capabilities tab + "add another copy" button
  Thu:       Buffer / regression catches
  Fri:       → Phase 8.3 closed by Aug 15
```

**Detailed 8.3 spec with SQL migration target and concrete test cases:** see `PHASE-8.3-RECAP.md` (next to this file).