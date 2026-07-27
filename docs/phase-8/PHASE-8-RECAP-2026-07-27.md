# Phase 8 & 8.5 — Recap (2026-07-27)

**Author:** Senku (recap after `message.txt`)
**For:** Mashu — review & scheduling

This is a **read-only** status report of what's done, what's left, and a proposed schedule. No code changes yet — waiting for Mashu's call on priorities and the open questions at the bottom.

---

## TL;DR

- **Phase 8 (Character Creation Modal):** the modal-based creation flow is **live** and works end-to-end. The biggest design deviation from the original plan: we shipped a **single tabbed UI** for both new and edit modes instead of the planned stepped wizard (Mode A) + tabbed editor (Mode B). Pragmatic simplification that worked.
- **Phase 8 (Character Sheet):** sheet reads server-resolved values and renders 6 tabs. **Stacking modifiers from primitive duplicates don't actually stack** because the bundle-expander dedupes primitives at write time. This is the gap your `message.txt` architecture diagram is solving.
- **Phase 8.5:** not started. Collections schema doesn't exist; `sourceOrigin` is still a freeform string; share-with-link and follow-list-views are in the schema but no UI.

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

### Concrete changes needed

1. **De-collapse bundle-expander:** change `expandBundles()` to emit **one row per occurrence**, not dedup. Origin metadata stays. DB schema needs to allow multiple rows per `(character_id, primitive_id)` — current PK enforces one row. Either:
   - **(a)** Add an `instance_id` UUID column; remove PK constraint, add unique on `(character_id, primitive_id, instance_id)`
   - **(b)** Keep dedup but only for storage; pass-through multiple "logical" instances to the engine

2. **Mirror refund at the economy layer:** when a direct slot's primitive_id is already in the owned set (inherited from heritage/capability), the direct slot's BU cost becomes **negative** (= mirror credit, equal to its cost). User can disable this toggle to "pay for a second copy" intentionally.

3. **Owned-set registry:** new function `computeOwnedPrimitiveSet(character)` — set of all primitive_ids present in any of: direct slot, heritage bundle, capability bundle, effect bundle. Used by Phase 2 to decide which direct additions are "free mirror."

4. **Wire stacking engine:** the API route that loads a character should now return a `modifier instances` array (one per primitive occurrence), not a deduped primitives array. The sheet (or a derived client-side pass) runs `evaluateModifiers()` over those instances per target.

5. **Character sheet UI:**
   - Multiple instances of same primitive display as separate cards in the Capabilities tab, each with its own origin badge
   - `<ConditionBadges>` drop-in on each card showing active/narrative/mirrored status
   - Sheet shows the **resolved value** for each stat (vitality, PB, awareness) alongside the modifier stack that produced it

### Scope estimate

This is a **substantial refactor** of the bundle-expander + DB schema + API + sheet. Realistic split:

- **8.3a — De-collapse expander + schema migration** (1.5–2 days)
- **8.3b — Owned-set registry + mirror refund in BU engine** (1 day)
- **8.3c — Sheet rewire to use instance array + stacking** (2 days)
- **8.3d — `<ConditionBadges>` drop-in on sheet** (0.5 day)
- **8.3e — Multiple-instance UI in Capabilities tab** (1 day)

Total: **6–7 days** of focused work.

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

Assuming you want to land Phase 8 before opening 8.5:

```
Week 1 (Aug 4–8):
  Mon–Wed: 8.3a — De-collapse expander + schema migration
  Thu–Fri: 8.3b — Owned-set registry + mirror refund

Week 2 (Aug 11–15):
  Mon–Wed: 8.3c — Sheet rewire to use instance array + stacking
  Thu:     8.3d — <ConditionBadges> drop-in
  Fri:     8.3e — Multi-instance UI in Capabilities tab

Week 3 (Aug 18–22):
  Buffer / integration testing / regression catches
  → Phase 8 closed by Aug 22

Week 4 (Aug 25–29):
  Phase 8.5 Track A — Collections schema + composer dropdowns
  (Skip Track B until 8.5 closeout design session)

Week 5 (Sep 1–5):
  Phase 8.5 Track A continued — UI for browsing collections
  + Track D start — share-with-link

Week 6 (Sep 8–12):
  Phase 8.5 Track D — profile page + default collections
  + Track B start — condition evaluator v1
```

This is **6 weeks of focused work** to close Phase 8 + a meaningful chunk of Phase 8.5. Tracks B and C can run in parallel with D after Week 4.

---

## Open Questions for You (no implementation until you answer)

1. **Dedup at write vs at compute.** Your `message.txt` suggests **no dedup at write** (keep all instances). But the current PK on `(character_id, primitive_id)` enforces one row. Option (a) requires a schema migration; option (b) keeps the constraint but adds a logical "instance counter" or moves dedup downstream. **Which way do you want it?**

2. **Mirror refund semantics.** When you slot a primitive directly that you already own via a heritage, do you want the system to:
   - **(A)** Auto-mark it as mirrored (free, +BU credit) — the user "intends to mirror"
   - **(B)** Default to "second copy" (paid) with a checkbox "Mirror this (use BU refund instead)"
   - **(C)** Different rule for "I really want to pay for a duplicate" vs "I want to mirror this one"

3. **Engine layer for sheet.** Today the sheet reads server-resolved values. With per-instance stacking, do you want:
   - **(A)** Server resolves everything (modifier engine on the API route), sheet is pure display
   - **(B)** Client-side pass: API returns raw instance array, sheet runs `evaluateModifiers()` in browser for live updates
   - **(C)** Hybrid: server resolves for read-only display, client re-resolves for the edit modal

4. **Phase 8.5 priority order.** My proposed order is A → D → B → C. Do you want to reorder, or skip some tracks entirely?

5. **Share-with-link scope.** Read-only source pages only, or also editable for collaborators (Google-Docs-style)?

---

*Once you answer these, I'll cut the schedule into actual implementation batches.*