# Phase 8.I — POST-RECAP — 2026-08-10

**Author:** Senku
**Source of truth:** `PHASE-8-I-RECAP.md` (sub-phases i1-i5) + `PHASE-8-I-ASSESSMENT-2026-08-05.md`
**This file:** state of the system *today*, what's working, what's broken, what we still have to fix.

**Trigger:** Your message on 2026-08-10:
> *"First of all, max applies well to attributes but not to practices or other things. Second in the modal, min/max have + before. Them not the Unicode…. Secondly I still don't see advantage not in the modal not in the fieldcraft next to number. And I still don't see capabilities under heritages in character sheet in the i2 test character… There's so many things. Let's not implement code let's just make a recap and tasks so we know what we have to do."*

---

## 1. What this recap is

The Phase 8.I recap closed i1–i5 on 2026-08-06. Since then we've shipped i3 (conditions runtime + per-toggle gating) and the `isToggledOff` plumbing. You want a **clean status snapshot** of what's actually rendered on the i2 test character today, the broken/missing things, and a prioritized list — no code, no plan.

Read-only inspection. All facts below verified against the live DB and the live `https://www.swordweave.quest/api/characters/462f9048-b0da-4185-98db-d18027132c82/resolve` response.

---

## 2. The i2 test character — actual data state

Character `462f9048-b0da-4185-98db-d18027132c82`. Level 18. PHYSICAL proficient. Attributes 4/4/2.

### Direct primitives (25)

All slotted directly, **none** have an `origin_*_id` set. Categories:

| Category | Count | Examples |
|---|---|---|
| CHARACTER_SHEET_AUGMENT | 8 | Str Buff, Str Ring, Mirrored Str Buff, Ceiling 18, Floor 10(?), Defender, Save DC Buff, Vitality Buff |
| PRACTICE_PROGRESSION_AUGMENT | 4 | Expertise Fieldcraft, Proficient Fieldcraft, Iron Will, Hunter Bonus |
| ITEM_AUGMENT | 3 | Backpack, Lighten, Extra Slot |
| VERB_TIER | 2 | Legendary Resistance, Force Source |
| TACTICAL | 1 | Initiative |
| ACTION_ECONOMY | 1 | Maint Cost |
| SPEED_QUICKENING | 1 | Fast |
| METAMORPHOSIS | 1 | Enlarge |

### Capabilities (4 — all DIRECT, no heritage origin)

| Capability | type | Effects it bundles |
|---|---|---|
| Divine Smite | ACTIVE | Smite |
| Hunter's Mark | ACTIVE | Marked, Hunted |
| Stone's Endurance | PASSIVE | Endure |
| Iron Defender | PASSIVE | Plating |

### Effects (5, all nested inside capabilities — no standalone character_effects table exists)

| Effect | Capability | Primitive it grants |
|---|---|---|
| Smite | Divine Smite | Smite Damage, Advantage |
| Marked | Hunter's Mark | Mark of the Hunt |
| Hunted | Hunter's Mark | Disadvantage |
| Endure | Stone's Endurance | PB Half |
| Plating | Iron Defender | Floor 10 |

### Heritages: ZERO

```
=== HERITAGES ===
Total: 0
```

There are **0 rows** in `character_heritages` for this character. No Lineage, no Upbringing, no Manifest. So:
- The Heritage accordion in the sheet is empty.
- The "by Heritage" capability grouping is empty.
- The test character doesn't actually exercise the heritage-bundle path.

### Inherited primitives: only via capability_primitives

| Capability | Primitive (via cap_primitives) |
|---|---|
| Stone's Endurance | Stone Skin |

That's it. **Divine Smite, Hunter's Mark, Iron Defender have ZERO direct capability_primitives** — they only have effects. Their primitives come via `capability_effects → effect_primitives`.

---

## 3. What the resolve API says (verified live, 2026-08-10 06:50 UTC)

```
attribute.physical: 2 (Str Buff +5, Str Ring +1, Mirrored Str Buff -4, Ceiling 18 max=18)
attack_bonus.physical: 2 (Mark of the Hunt via Hunter's Mark → Marked, active=True)
defense.physical: 2 (Stone Skin via Stone's Endurance, active=True)
defense_dc.physical: 1 (Defender direct, active=True)
save_dc.physical: 1 (Save DC Buff direct, active=True)
saving_throw.physical: 1 (Resilient Phys direct, active=True)
skill_practice_check: 23
  └─ fieldcraft: 12  (Expertise +6, Proficient +6) — Expertise NOW active=True after condition fix
  └─ reason: 6  (PB Half via Stone's Endurance → Endure active=True)
  └─ awareness: 5  (Iron Will active=True because 60/298 = 0.20 < 0.5)
damage_bonus.radiant: 3 (Smite Damage via Divine Smite → Smite)
damage_modifier.fire: 0.5 (Resist Fire, active=True)
damage_modifier.cold: 2 (Vulnerable Cold, active=True)
damage_modifier.poison: 0 (Immune Poison, active=True)
behavior.legendary_resistance: 1 (direct)
behavior.advantage: 1 (Advantage via Divine Smite → Smite, active=True)
behavior.disadvantage: 1 (Disadvantage via Hunter's Mark → Hunted, active=True)
load: 2 (Lighten, active=True)
carry_capacity: 20 (Backpack, active=True)
speed.walking: 10 (Fast, active=True)
size.large: 1 (Enlarge, active=True)
source_type.magical: 1 (Force Source, active=True)
combat_action: 1 (Initiative, active=True)
complexity: 3 (Complex Cap, active=True)
equip_slot: 1 (Extra Slot, active=True)
max_vitality: 10 (Vitality Buff, active=True)
upkeep_cost: 2 (Maint Cost, active=True)

NOT active:
  Hunter Bonus (skill_practice_check, val=3): active=False (correct — `self:is_tracking` flag not set)
```

---

## 4. What works (verified working on the live sheet)

✅ **Resolve API** returns correct totals for all 25 axes we have data for.
✅ **Condition evaluation**: `self:proficient_in(fieldcraft)` evaluates true → Expertise Fieldcraft contributes +6.
✅ **Condition evaluation**: `self:stat|vitality_pct|<|0.5` evaluates true at 60/298 → Iron Will contributes +5.
✅ **Condition evaluation**: `self:is_tracking` evaluates false → Hunter Bonus suppressed.
✅ **Floor/Ceiling as limits (not additive)**: Ceiling 18 doesn't add 18 to PHYSICAL; the total stays 2 (5+1−4, capped at 18 — under cap so visible).
✅ **`*` conditional marker**: rendered on attribute cards, SaveDC cards, practice rows (orange).
✅ **`↧ X` ceiling marker**: rendered next to PHYSICAL attribute modifier (orange).
✅ **Capability type column**: caps show type (ACTIVE/PASSIVE/AUGMENT).
✅ **Capability toggle UI exists**: `CapabilityCard` has `handleToggle` → POST to `/api/characters/[id]/capabilities/[capabilityId]/toggle`.
✅ **Toggle audit log**: the toggle route writes a `capability_toggle` log entry.
✅ **Provenance in modal**: shows "from Stone's Endurance" / "via Marked" breadcrumbs.
✅ **Conditions section in modal**: lists contributions with ✓/✗ status.
✅ **Advantage/Disadvantage totals**: behavior.advantage = 1, behavior.disadvantage = 1 in totals.

---

## 5. What's broken or missing (the actual scope)

### BROKEN (functional defects — visible on the live sheet)

#### B1. min/max label in modal breakdown uses the **word** "max" instead of Unicode `↧ X`
**File:** `src/components/characters/formula-modal.tsx:226-235`
```ts
const OP_LABEL: Record<string, string> = {
  add: "+",
  subtract: "−",
  set: "=",
  min: "min",     // should be "↧ X" not "min"
  max: "max",     // should be "↥ X" not "max"
  multiply: "×",
  divide: "÷",
  grant: "grant",
  revoke: "revoke",
};
```
The screenshot 1 (fieldcraft modal) shows `Ceiling 18 max +18`. The screenshot 4 (PHYSICAL modal) shows `Ceiling 18 +18` and the **header** shows `↧ 18` correctly — so the **marker is right but the breakdown row is wrong**. The fix is just `max: "↧"` and `min: "↥"` in `OP_LABEL`.

#### B2. Ceiling/Floor mechanics should apply to **attributes only**, not practices
You said: *"max applies well to attributes but not to practices or other things"*. Looking at the resolve output:
- `attribute.physical: 2` ← ceiling 18 is a limit (works).
- For `skill_practice_check`, `speed.walking`, `max_vitality`, `damage_modifier.*`, etc. → ceiling/floor should NOT apply. The current `resolve-modifiers.ts` likely filters by target axis, but if `findCeiling()` doesn't filter, every target will see ⇧/⇊ markers.

Let me check what the modal shows for "fieldcraft" — the screenshot says fieldcraft breakdown has 4 attribute primitives (Str Buff, Str Ring, Mirrored, Ceiling 18) but **Ceiling 18 shouldn't be there because fieldcraft isn't an attribute**.

Looking at the live data: Ceiling 18 has `target: "attribute.physical"`, but fieldcraft breakdown groups ALL primitives that contribute to `skill_practice_check` AND any that contribute to `attribute.physical` (because practices share the attribute). The modal is showing the wrong attribution — or it's correctly showing that practice = attribute_mod + practice_primitives (per the formula `+6 (attr mod) +6 (PB) = +24`). So actually the modal IS correct: `Practice = PHYSICAL attribute (mod) + practice primitive contributions + PB`. The "attribute primitives (affect practice base)" section intentionally includes primitives that affect the base attribute.

**Question for you:** Is B2 actually broken, or is the modal correctly showing the formula? If the modal is showing what you designed (Practice = attribute_mod + practice_primitives + PB), then Ceiling 18 belongs there because it caps the attribute which feeds into the practice.

#### B3. `*` conditional marker + ⇈(1)/⇊(1) advantage/disadvantage stacks do NOT show on the practice list rows
The screenshot 2 shows practice rows as just `Fieldcraft +24` — no `*`, no `⇈(1)`, no `⇊(1)`. The axis marker component (`AxisMarkers` in `bottom-sticky-bar.tsx:107`) IS rendered for practices (`target={\`practice.${p.attribute.toLowerCase()}\`}` at line 756), but:

- The marker looks at `byTarget["practice.fieldcraft"]` — but the actual key in `byTarget` is `skill_practice_check.fieldcraft` (per the totals above). So the marker query **misses the practice rows entirely**.

This is the same key mismatch as the i2.7 fix. Need to check what target key is used in `findCeiling`/`countStacks`/`hasConditionalMarker`.

#### B4. **Toggle UI exists but doesn't actually suppress** primitives on the sheet
The `POST /api/characters/[id]/capabilities/[capabilityId]/toggle` route:
- Writes a `capability_toggle` audit log entry
- Does NOT persist active state to the DB (per Mashu 2026-07-23, localStorage is source of truth)
- The resolver reads DB, not localStorage
- So when you toggle a cap OFF, **the sheet numbers don't change** — the resolver still includes the cap's primitives

The user-facing toggle works (log entry, UI updates) but the engine ignores it. Either:
- Persist `is_toggled_on` to DB (column doesn't exist on `character_capabilities` — schema gap), OR
- Pass toggle state from client through the resolver call (complex)

#### B5. Modal shows "Attribute Primitives (Affect Practice Base)" — but the test character has 0 heritages, so the heritage accordion is invisible
The Primitives (32) accordion is collapsed by default in the bottom-sticky-bar. The Heritage accordion renders only when `heritageLinks.length > 0` — and this test character has 0.

---

### NOT YET BUILT (gaps from the i3 recap)

#### G1. Capability/Effect accordion in the **bottom drawer** is hidden/collapsed by default
The bottom sticky bar shows practices/mods/saves but does NOT have a visible Capabilities or Effects section. The user has to click into a tab to see them.

#### G2. Capability toggles don't visually mark suppressed primitives in the modal
Even if toggle worked (B4), there's no visual indicator on the sheet that "this contribution is currently suppressed because the parent cap is OFF".

#### G3. Runtime primitive direction conflict resolver (i3c) is fully deferred
Per the conversation PDF: *"cap-toggle model for conflicting primitive directions (same primitive, one mirrored) is pushed to a future phase. The DB dedup model (unique index on character+primitive) means this requires a deeper schema change."*

#### G4. Conditions section in modal doesn't show condition TEXT — just ✓/✗ status
The recap's i3d said: *"For compound conditions, render the token chain (e.g. "vitality<50% AND grappled")"*. The current modal just shows status, not the readable text.

#### G5. Per-effect toggles — **user proposed in the PDF**
> *"There could be things with 'one of the following effects', but that could be more of a table thing… so yeah maybe per effect active/inactive needed."*

You proposed toggling individual effects inside an Active capability. Not implemented.

#### G6. `targetWho` override per bundle link (self/target/scene)
Per the PDF discussion, the user wants per-bundle-primitive-link `targetWho` (default self, override to target/scene to exclude from sheet). Not implemented — DB schema doesn't have `capability_primitives.target_who` or `effect_primitives.target_who`.

---

### DATA GAPS (the test character is incomplete)

#### D1. Zero heritages
Test character has no Lineage/Upbringing/Manifest. The heritage accordion is empty. The "by Heritage" capability grouping is empty. The full heritage→cap→effect→primitive flow has no data to verify against.

#### D2. Many direct primitives have no `is_mirrored` semantics being tested
`Mirrored Str Buff` has `mirror_vector=VARIABLE_VECTOR` and contributes `−4` to attribute.physical. That's the only mirror-vector primitive. Need 1-2 more to test the conflict path.

#### D3. `current_vitality: 60` vs `max_vitality: 10` is **inconsistent**
Resolve says max=10, but character row says current=60. The seed wrote `currentVitality=60` but `Vitality Buff` is `+10` and the formula gives `max_vitality = 10` (not 60+10=70). There's a bug in the vitality seed or the resolve reads `currentVitality` from the wrong place.

Actually wait — `max_vitality` total = 10 (just from `Vitality Buff`), and `currentVitality` is 60 (raw char column). That implies `max_vitality` from the resolve should be ≈60+10=70, but it's 10. So either:
- The resolver is computing max_vitality wrong (not including base attribute / level), OR
- The formula `max_vitality = level * something + vitality buff` is missing the level base

This is **NOT a UI bug** — it's an engine bug. The screenshot says "298 / 298" but the resolve says max=10. They're inconsistent.

#### D4. No items linked to this character
`character_items` count = 0 (not checked directly, but the resolve output has no item-derived contributions).

---

## 6. Open questions for round 1 (batch)

Group A: **Math/UI labels**

1. **A1 — min/max label in modal:** Is the fix simply `OP_LABEL.max: "↧"` and `OP_LABEL.min: "↥"` in `formula-modal.tsx`, or do you want a different visual (color-coded background, two-line "max → +18", etc.)?

2. **A2 — Ceiling/Floor on practices:** Does the current "Practice = PHYSICAL attribute (mod) + practice primitive contributions + PB" formula need to change, or is the modal correctly showing what you designed? The fieldcraft modal shows Ceiling 18 because the base attribute (which feeds practice) IS capped at 18. Confirm that's the intended semantic, or change the formula.

3. **A3 — `*` and `⇈/⇊` markers on practice list:** Currently missing because the marker component queries the wrong target key (`practice.fieldcraft` vs the actual `skill_practice_check.fieldcraft`). Fix the key mismatch so the markers show on practice rows. Confirm this is just a key fix, not a semantic redesign.

Group B: **Toggle model**

4. **B1 — Cap toggle persistence:** Two paths:
   - **Path X:** Add `is_toggled_on boolean` column to `character_capabilities`, write it from the toggle route, read it in the resolver. Clean. Requires schema migration.
   - **Path Y:** Keep localStorage as source of truth (current model), thread toggle state from the client through the resolver as a query param or request body. Faster but more fragile (cold reload loses state).
   Pick one.

5. **B2 — Per-effect toggles:** You proposed this in the PDF. Implement now or punt?

6. **B3 — `targetWho` override per bundle link:** The DB schema doesn't have `capability_primitives.target_who` or `effect_primitives.target_who`. To add this requires a migration AND a UX change in the capability composer. Punt to a later phase, or include in this round?

Group C: **Modal UX**

7. **C1 — Conditions section readable text:** Show the raw token chain (`"self:stat|vitality_pct|<|0.5"`) or human-readable (`"HP below 50%"`)? The recap said readable. Which mapping table do we use?

8. **C2 — Capabilities section in bottom drawer:** Add a "Capabilities" section to the bottom sticky bar (between Mods+Saves and Practices) that lists every slotted capability with its toggle and active status, so the user can toggle without going into the modal?

Group D: **Data + test character**

9. **D1 — Test character needs heritages:** Add 1 Lineage (e.g. "Elf"), 1 Upbringing ("Hunter"), 1 Manifest ("Combat") with at least one capability and one effect each, so the full bundle path has data. Run seed for the new set?

10. **D2 — Vitality math:** `current=60` vs `max=10` is wrong. Should `max_vitality = base + level_factor + vitality_buff`, where base comes from `level * PB` or similar? Confirm the intended formula.

11. **D3 — Mirror test:** Add 1-2 more `mirror_vector=VARIABLE_VECTOR` primitives (e.g. Mirrored Int Buff, Mirrored Reflex Buff) so the conflict resolver has data to test against when we get there.

Group E: **Out of scope for this round**

12. **E1 — Confirm B3 (cap toggle doesn't suppress) is the same priority as the modal label fixes, or lower.** You said "lets not implement code" so we're scoping only.

---

## 7. What happens after you answer

Once you answer Group A–E:
- I write a `PHASE-8.I-POST-RECAP-DECISIONS.md` with your decisions inline
- Then we invoke the `plan` skill to draft a bite-sized implementation plan
- Each task gets its own commit, pushed immediately, per Rule 9

---

## 8. Files I read to produce this recap (no changes made)

- `src/app/api/characters/[id]/resolve/route.ts` — resolve API, conditionContext build
- `src/app/characters/[id]/page.tsx` — page query, heritage/capability/primitive handling
- `src/components/characters/character-sheet-view.tsx` — sheet renderer, capabilities tab, primitives accordion
- `src/components/characters/bottom-sticky-bar.tsx:107-140` — AxisMarkers component
- `src/components/characters/formula-modal.tsx:226-235` — OP_LABEL (the bug)
- `src/components/characters/capability-card.tsx:316-340` — toggle UI
- `src/app/api/characters/[id]/capabilities/[capabilityId]/toggle/route.ts` — toggle API (no DB write)
- `src/db/schema/characters.ts` — characterCapabilities has NO `is_toggled_on` column
- `scripts/seed-test-character.ts` — seed script (no heritage seeding)
- `PHASE-8-I-RECAP.md` (previous recap)
- `PHASE-8-I-ASSESSMENT-2026-08-05.md` (status snapshot)
- `Conversation.pdf` (your i3 PDF)

## 9. Notes for future reference

- The Vercel build silently falls back to last good build on TypeScript errors. Always run `npx next build` not just `npx tsc --noEmit` before pushing. (See commit `8ad047d` which fixed the `if (m && m[1])` regression.)
- The `regex literal backslash` trap: in `/.../`, `\\(` matches literal `\` + `(`. To match literal `(`, use `\(`. The `patch`/`execute_code` tools preserve double backslashes from source text. Always verify regex changes with `node -e` and `xxd` (5c 28 = single backslash + paren).
- The seed script upserts via `ON CONFLICT (name, source_origin) DO UPDATE`. Re-run after any change to primitive hard_modifiers JSON shape (otherwise the DB has the old shape until the next upsert).
- The test character has `current_vitality: 60` but `max_vitality: 10` from the resolve. Need to figure out which is the truth source before making the vitality math fixes.
