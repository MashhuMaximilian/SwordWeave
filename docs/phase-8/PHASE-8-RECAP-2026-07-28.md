# Phase 8 — Recap as of 2026-07-28

**Author:** Senku
**For:** Mashu — review before planning 8.3e wrap-up, 8.3f, and 8.4
**Repo state:** `14c65fd` (Phase 8.4 v8), 1850/1852 tests passing (2 pre-existing
Notion failures, unrelated)

---

## What's actually shipped — phase by phase

### Phase 8.3a — Multi-instance primitive model ✅
**Commit:** `63a744a`

- Migration `0048_multi_instance_primitives.sql` — dropped PK
  `(character_id, primitive_id)`, added `instance_id UUID defaultRandom()`,
  partial unique indexes for inherited rows + mirror rows, allowed
  multiple direct-paid rows.
- Drizzle schema updated (`src/db/schema/characters.ts`).
- All old `character_primitives` rows backfilled with unique
  `instance_id`s; nothing lost.

### Phase 8.3b — Modal store reworked direct-slot writes ✅
**Commits:** `2206605`, `7779d23`, `da61979`, `22faa13`, `21281d8`,
`096494b`, `644a783`, `76acd03`, `b706fcc`, `79a83ac`, `add3aaf`,
`b3a3af5`

- `character-modal-store.tsx` direct-slot writes now INSERT (not
  update) — each direct slot is a separate row with a fresh
  `instance_id`.
- Mirror toggle writes a separate row with `is_mirrored = true`
  and `origin IS NULL`. The engine resolves the mirror against
  the inherited baseline (or against a direct-paid copy if no
  inheritance exists).
- UI: per-instance copy counter on the manifest tab, "Add
  another copy" button, mirror toggle next to each direct-paid
  instance.
- Save flow: hard-navigate to `/characters/[id]` (soft-nav was
  silently stranding users on `/atelier`). Leave-page dialog
  suppressed on successful save (was firing on the second
  push). Triple-yin spinner during save.
- Auto-preload bundles (`preloadHeritageBundles`,
  `preloadCapabilityBundles`) so BU footer reflects seeded
  characters immediately.
- 1850/1852 tests pass (same Notion failures predate 8.3b).

### Phase 8.3d — ConditionBadges drop-in ✅
**Commits:** `3bdeada`, `57e8c76`

- Primitive rows in the sheet now read `hard_modifiers` from
  the API and pass them through to `ConditionBadges` (the
  existing component from `src/components/library/
  condition-badges.tsx`).
- Root cause bug fixed: PrimitivePreviewCard was passing the
  whole `HardModifier` to `ConditionBadges` instead of
  `mod.condition` — the `kind: "modify"` was being parsed as
  a condition kind, crashing the Capabilities tab on Tessy's
  "Ironborn fork test" heritage.

### Phase 8.3e — Entity Preview cards (Primitive / Effect / Heritage) ⚠️ PARTIAL
**Commits:** `b906988`, `0cb899f`, `f85b0a3`, `f61cdec`, `d142977`

- ✅ **PrimitivePreviewCard** — full implementation. Each
  primitive row in the Capabilities tab is a clickable card;
  clicking opens the unified `EntityPreview` modal
  (`useEntityPreview()`) with the full primitive fetched
  lazily from `/api/primitives/[id]`.
- ✅ **EffectPreviewCard** — component exists at
  `src/components/characters/effect-preview-card.tsx`.
- ✅ **HeritagePreviewCard** — component exists at
  `src/components/characters/heritage-preview-card.tsx`.
- ❌ **Multi-instance UI in Capabilities tab** — primitives are
  listed, but not broken out as separate cards per instance
  (Tessy has 3 separate primitive rows but they show as one
  entry each). The recap spec said "Multiple instances of same
  primitive display as separate cards in the Capabilities tab,
  each with its own origin badge". Currently the grouping by
  primitive ID is NOT separated.
- ❌ **"Add another copy" button on the SHEET (not the modal)** —
  the button exists in the character creation modal's manifest
  tab, but not on the sheet's Capabilities tab.
- ❌ **Heritages accordion on Capabilities tab** — was added in
  `f61cdec` but reverted in `d142977` because the canon bundle
  showed "0 bundled" for pre-migration characters. Re-shipped
  in `8.4 v3` using the heritage TEMPLATE's canon bundle
  instead of the character's slot origin. Just landed in
  `8.4 v8` with full nested depth (effects + primitives per
  capability via lazy `/api/heritage/[id]`).

### Phase 8.4 — Mobile UI revamp (in progress) 🔨
**Commits:** `1226cbd`, `59a17ea`, `62c83f9`, `0694703`, `b523548`,
`0d2ca51`, `90de758`, `6798c0f`, `dd15a76`, `14c65fd`

The mobile-only redesign per the UI_ch_sheet.pdf spec. Desktop UI
is unchanged for now (will be discussed separately per Mashu's
2026-07-27 instruction: "all the design I am telling you about
that was in the PDF is for mobile only!").

**Shipped (v8 / latest):**
- ✅ **BottomStickyBar** — collapsed row at `bottom-12` showing
  HP, attribute modifiers, PB. Click expands to a drawer with
  VitalityTracker + 3-column practice grid (Physical / Mental /
  Magical with attribute modifier chips in the title row) +
  Long Rest / Short Rest / Damage / Heal buttons. Drawer
  positioned at `bottom-[4.75rem]` so its bottom edge aligns
  with the bar's top edge (z-50 overlay).
- ✅ **SheetIdentityHeader** — portrait, name, level, size,
  expanded view with Clone / Level Up / DM Bonus / debt
  (used / available / max allowed format) / mirrored
  primitives.
- ✅ **BuBudgetFooter hidden on mobile** (since the header
  covers it).
- ✅ **Capabilities tab** — three accordions, all open by
  default:
  1. **All Primitives** (grouped by origin: heritage /
     capability / direct, with PrimitivePreviewCard rows
     including condition badges + BU cost).
  2. **Capabilities** (by Style A/B/C, with CapabilityCard
     per capability — toggleable, triggerable, with
     effectLinks nested).
  3. **By Heritage** — HeritageBundleView (new in v8) per
     heritage. Lazy-loads full bundle via
     `/api/heritage/[id]`. Each capability shows: name
     (preview-clickable) + slotted chip + description +
     collapsible Effects (with transitive primitiveLinks,
     BU per primitive) + collapsible Primitives.
- ✅ **PracticesPanel** — single column in Overview tab,
  3-column in BottomStickyBar expanded drawer.
- ✅ **PROF bonus** — shown in the Vitality card's
  attrBestTotals row (PHYS <best> | MENT <best> |
  MAGI <best> | PROF +<pb>).
- ✅ **Quick Practices title row** — `PHYS -3 | MENT -3 |
  MAGI -5 | PROF +6 PB` chips inline.
- ✅ **VitalityTracker** — compact mode for narrow screens
  (single row of 4 buttons even at 360px width).
- ✅ **TabErrorBoundary** — class component wraps the
  Capabilities tab so any future render error shows an
  inline "this tab crashed" message instead of
  white-screening the sheet.
- ✅ **Attribute modifier delta** — `attributeModifierDelta`
  helper computes the per-attribute delta from slotted
  primitives' hardModifiers (presentation-time approximation;
  full write-time eval still pending).
- ✅ **Inverted BU bar colors** — green at 100% used,
  orange under-used, red over-budget.
- ✅ **Critical modal fix in v7** — the depth-3+ Drizzle
  `with:` join inside `heritage.heritage.capabilityLinks
  .capability.effectLinks.effect` was breaking
  Postgres's LEFT JOIN LATERAL and causing every character
  GET to 500. Modal couldn't seed, hung on "is seeding…".
  Reverted the heritage join back to
  `{ with: { capability: true } }` and lazy-load the
  effect/primitive data per heritage via the existing
  `/api/heritage/[id]` (which already has the flat-SELECT
  workaround attached).

**Not shipped in 8.4 (still pending for this phase or 8.4.b):**
- ❌ **Write-time engine evaluation** — modifiers are still
  presentation-time approximation. Every change to a
  primitive's mirror state, every heritage bundle
  expansion, every direct-slot add/remove should re-run the
  full engine to recompute HP, PB, attributes, practices.
  Currently the sheet shows best-effort numbers but
  doesn't trust them as canonical.
- ❌ **Custom-stat system** — Phase 8.6 in the original plan
  (`characters.custom_stats` jsonb, `auto:<stat>` and
  `player-toggle:<stat>` condition resolution paths).
- ❌ **Live condition evaluator v2** — `evaluateCondition()`
  still returns `true` for v1 conditions (no
  `target-below-half-hp`, no custom-stat bool reading).
- ❌ **Conditions accordion on the sheet** — no
  `character_conditions` table, no add-condition UI.
- ❌ **Click primitive → expand tags/ops/modifiers/behavior
  slots** on the sheet (PrimitivePreviewCard already
  opens the entity preview modal which has all of this —
  but in a modal, not inline).
- ❌ **Behavior references resolve live** — capability cards
  show "While active: damage − blockValue (currently 6)"
  as static text; doesn't actually resolve.
- ❌ **Desktop UI revamp** — explicitly deferred per Mashu's
  2026-07-27 instruction.
- ❌ **PDF Section 2 (CoreStatsCard)** — was added then
  removed (duplicate of BottomStickyBar's collapsed row).
  Spec might want it back in a desktop layout.

---

## What 8.3e actually needs to ship (per the recap spec)

The recap from `2026-07-27` lists:
- Show each direct-paid instance as a separate card
- Each card has its own origin badge (or "Direct" badge)
- "Add another copy" button on direct-paid primitives
- Mirror toggle button on each direct card

**Current state vs spec:**
- PrimitivePreviewCard renders per primitive_id (not per
  instance). Tessy has 3 primitive rows in DB but the
  Capabilities tab shows 3 entries (one per primitive_id,
  not per instance).
- "Add another copy" only exists on the modal's manifest
  tab. Sheet has no such button.
- Mirror toggle only exists on the modal. Sheet shows the
  mirror chip (read-only).

**To finish 8.3e:**
1. Sheet's All Primitives accordion should GROUP BY
   instance (not primitive_id), so two direct-paid
   copies of Vitality Core Augment I show as two rows.
2. Add an "Add another copy" button to each direct-paid
   row (calls the same direct-slot API the modal uses).
3. Sheet-side mirror toggle (currently read-only chip).

---

## What 8.3f could be (not in any recap — fresh)

Looking at what's NOT in any plan doc but is clearly the next
step:

**Option A: Engine resolver at write time** — make
`attributeModifierDelta` and friends actually evaluate
modifiers properly (not approximation). Wire it into:
- `PATCH /api/characters/[id]` — re-evaluate on save
- `/api/characters/[id]/adjust` — re-evaluate on damage/heal
  math helpers
- Sheet's mirror toggle — re-evaluate immediately

**Option B: Conditions + custom stats** — Phase 8.6 from
the original plan:
- `characters.custom_stats: jsonb` migration
- Condition evaluator v2 with `auto:<stat>` and
  `player-toggle:<stat>`
- Conditions accordion on the sheet
- "Add condition" composer

**Option C: Behavior references live** — Phase 8.4 work
that was deferred:
- `capability_toggle` log already exists
- `behavior` token already in equations
- Capability cards on the sheet should show
  "While active: damage − blockValue (currently 6)"
- Resolve blockValue live from the slotted primitive

---

## What's in 8.4 (mobile UI revamp) that's still pending

Strictly UI-only (no engine work):
- **Desktop UI revamp** — explicitly deferred.
- **Quick Practices row totals** — currently using
  presentation-time `bestPracticeTotalForAttribute()`. When
  the engine resolver lands this should be replaced with
  the canonical number.
- **DefensiveDCs** — currently hidden on mobile (md:flex)
  because the new attrBestTotals row duplicates its
  content. Desktop UI revamp may want it back.
- **Modal-based primitive preview vs inline expand** —
  PrimitivePreviewCard opens a modal; spec might want
  inline expand on the sheet.
- **Tests** — bottom-sticky-bar, sheet-identity-header,
  heritage-bundle-view all lack dedicated component
  tests. The TabErrorBoundary has one. Conditional badges
  have one.
- **Component composition audit** — character-sheet-view
  is still 2300+ lines. Should be split into
  CapabilitiesTab / ItemsTab / OverviewTab files.