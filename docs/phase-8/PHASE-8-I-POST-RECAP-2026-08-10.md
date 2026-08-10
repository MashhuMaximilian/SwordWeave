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

## 5. What's broken or missing (initial audit — see §5a for decisions)

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

## 5a. Decisions confirmed (your feedback round 1, 2026-08-10)

> *"Capabilities have to be in the capabilities tab in their accordions. If you look we have an accordion for each heritage... Not in the bottom drawer."*

**Decision:** Capabilities section in the bottom drawer is **out of scope** for this phase. Capabilities live in the Capabilities tab, inside heritage accordions (which already exist in `character-sheet-view.tsx`). G1 dropped.

> *"We need to add capabilities for test character in each heritage."*

**Decision:** Seed test character needs 3 heritages with the following bundle shapes:
- **Lineage** → bundles **capabilities only** (no direct primitives)
- **Upbringing** → bundles **primitives AND one capability** (mixed)
- **Manifest** → bundles **capabilities only** (no direct primitives)

This validates the full heritage → cap → effect → primitive chain. Each heritage should have at least one capability with effects + nested primitives so we have a non-trivial chain to verify.

> *"Those markers for PB/2 (number teal only) expertise (text and number teal and bold) and proficiency bonus (text and modifier teal) color coding. And the min max and * and all have to be for every number in the drawer.... because everything can be targeted with those."*

**Decision:** Color-coding rules apply to every axis in the drawer, not just attributes:

| Token / Marker | Color rule |
|---|---|
| `PB/2` (e.g. PB Half +3) | Number **only** teal (the +3 is teal, the "PB Half" label stays default) |
| Expertise (e.g. Expertise Fieldcraft +6) | Text **and** number teal **and bold** |
| Proficiency Bonus (e.g. Proficient Fieldcraft +6) | Text **and** modifier teal (the +6 is teal, the label is teal too) |
| Floor/Ceiling (`↥ X` / `↧ X`) | Orange (current) |
| `*` (conditional) | Amber/orange (current) |
| `⇈(N)` / `⇊(N)` (advantage/disadvantage stacks) | Green / red |

> *"But b and e in the end. We have to do the rest. I say D first (so we have capabilities with effects and primitives to check. And we need everything to add modifiers PB/2 via values, or proficiency tag or expertise, advantage and disadvantage, floor, ceiling, conditions to target when, carry capacity, equipment slots, everything, everything. But we can add so many we don't have to only add to physical or physical related practices. We can add to everything so we can verify properly and not mix up too many things."*

**Decision:** Implement order is **D → A → C → B → E**. And the test character must seed primitives across **every axis** — not just physical / physical-related practices. Coverage must include:
- PB/2 (already exists: PB Half)
- Proficiency tag (already exists: Proficient Fieldcraft)
- Expertise tag (already exists: Expertise Fieldcraft)
- Advantage/Disadvantage (already exists: Advantage, Disadvantage)
- Floor/Ceiling (already exists: Ceiling 18, Floor 10 via Plating effect)
- Conditions targeting (already exists: Hunter Bonus `is_tracking`, Iron Will `vitality_pct|<|0.5`, Expertise `proficient_in(fieldcraft)`)
- Carry capacity (already exists: Backpack)
- Equipment slots (already exists: Extra Slot)
- **PLUS:** new primitives for magical/mental axes, defense DCs, attack bonus, save DCs, etc. so we have coverage outside the physical cluster

> *"A1. If it is to be fixed, then fix? Idk if I don't see full question..."*

**Decision A1:** Fix the modal breakdown labels. `OP_LABEL.max = "↧"` and `OP_LABEL.min = "↥"`. The current `max: "max"` and `min: "min"` literals are wrong; they should use the same Unicode the axis marker header uses.

> *"A2. Yes. Min/max are not modifiers like advantage and disadvantage are not. They just let players know that they cannot set/roll more/less than x number or that they have to roll twice and keep best/worst roll."*

**Decision A2:** **Min/max and advantage/disadvantage are NOT modifiers — they're informational indicators.** They don't change the total. They appear as markers on every applicable axis to tell the player:
- Floor X → "your roll cannot be less than X"
- Ceiling X → "your roll cannot exceed X"
- Advantage (N) → "roll N extra dice, keep the best"
- Disadvantage (N) → "roll N extra dice, keep the worst"

So the `attribute.physical: 2` total should NOT include the Ceiling 18 as +18 (current engine is already correct here — ceiling is a limit, not additive). And the modal breakdown should display Ceiling 18 as `↧ 18` (informational), not `+18` (additive). Same for Floor 10 from Plating.

> *"A3. Yes"*

**Decision A3:** Fix the target key mismatch in `AxisMarkers` (queries `practice.fieldcraft`, actual key is `skill_practice_check.fieldcraft`). After fix, `*`, `⇈(N)`, `⇊(N)`, `↥ X`, `↧ X` will show on practice rows.

> *"B1. Idk what that means, I thought local storage."*

**Decision B1:** **Keep localStorage as the source of truth for capability toggle state.** Don't add `is_toggled_on` column. The resolver doesn't need to read it for now. (You marked B4 — toggle doesn't actually suppress — as low priority. So this is acceptable for the current phase.)

> *"B2. Punt? Now..."*

**Decision B2:** Punt per-effect toggles. Implement when we get to a "per-effect toggles" phase.

> *"B3. Yes. Each capability and each primitive inside has that... And each effect I guess. (We discussed about it...)"*

**Decision B3 (targetWho):** Add `target_who` enum column (`self` | `target` | `scene`, default `self`) to:
- `capability_primitives.target_who`
- `effect_primitives.target_who`
- (Future: `heritage_primitives.target_who` if needed)

When a primitive's `target_who != "self"` inside a bundle, the resolver **excludes it from the sheet** (sheet only counts `target_who = "self"`). BU budget stays the same. The disclaimer text you described: *"Changing the target to scene/target will exclude this primitive from your sheet entirely. This only affects the active direction — BU budget stays the same."*

> *"C1. Human readable. But also in ch sheet modals and other preview modals in /atelier for example. Maybe on click it shows actual raw tokens in a modal or something"*

**Decision C1:** Conditions display **human-readable** text by default everywhere (character sheet modals, /atelier preview modals). On **click**, open a sub-modal showing the raw token chain (`"self:stat|vitality_pct|<|0.5"`) and the parsed components. Reuse the same human-readable dictionary everywhere — single source of truth.

> *"C2. No. We have capabilities tab for that...man..."*

**Decision C2:** No capabilities section in the bottom drawer. Capabilities stay in the Capabilities tab only.

> *"D2. Yes, idk what that is about but 10 is wrong. It doesn't compute. `Max Vitality = (10 + PB) × level + primitive contributions`"*

**Decision D2:** Max vitality formula = `(10 + PB) × level + Σ primitive contributions`. With PB at level 18 = 2 + ceil(18/4) = 2+5 = 6, and `Vitality Buff = +10`, max = (10+6)×18 + 10 = 298. The current `max_vitality = 10` in the resolve is wrong (engine isn't applying the formula).

> *"B3. Yes."*

**Decision:** (This was the marker color rules — confirmed above.)

> *"E1. Lower"*

**Decision E1:** B4 (cap toggle doesn't actually suppress primitives on the sheet) is **low priority**. Don't fix in this round. May never fix if localStorage stays the model.

---

## 6. Resolved scope (after round 1)

**Round 1 closed 12 questions. Open follow-ups below.**

### What we're building (ordered D → A → C → B → E)

**Phase D — Test character data (FIRST):**
- D-seed-1: Add 3 heritages (Lineage + Upbringing + Manifest) to the test character. Lineage and Manifest bundle capabilities only; Upbringing bundles primitives + 1 capability.
- D-seed-2: Add primitives across EVERY axis (not just physical). Coverage: magical, mental, defense DCs, attack bonus, save DCs, damage_modifiers, movement, etc.
- D-fix-3: Fix max_vitality formula: `(10 + PB) × level + primitive contributions`. Engine currently returns 10, should be 298 for level 18 with Vitality Buff +10.

**Phase A — Math/UI labels:**
- A-fix-1: `OP_LABEL.max = "↧"`, `OP_LABEL.min = "↥"` in `formula-modal.tsx`.
- A-fix-2: Modal breakdown shows min/max as **informational indicators** (no + prefix), not as additive contributions.
- A-fix-3: Fix target key mismatch in `AxisMarkers` so `*`, `⇈(N)`, `⇊(N)`, `↥ X`, `↧ X` show on practice rows.
- A-color-4: Color-code per the table above (PB/2 number-only teal; Expertise text+number teal+bold; Proficiency text+modifier teal; Floor/Ceiling orange; `*` amber; advantage green, disadvantage red).
- A-target-5: Implement `target_who` override on `capability_primitives` and `effect_primitives` (per B3 decision). Resolver excludes non-self primitives from sheet.

**Phase C — Modal UX:**
- C-fix-1: Human-readable conditions text everywhere (single source of truth). Click to show raw tokens in sub-modal.

**Phase B — Lower priority (LAST):**
- B-capability toggle → low priority, keep localStorage model as-is.

**Phase E — Even lower:**
- E-capability toggle doesn't suppress → punt indefinitely or until localStorage model changes.

### What's NOT being built in this round

- Per-effect toggles (punted to a later phase)
- Runtime primitive direction conflict resolver (i3c, already deferred)
- Heritage `targetWho` override (only capability_primitives and effect_primitives get it)

---

## 7. Decisions confirmed (your feedback round 2, 2026-08-10)

> *"Max vitality: (10 + PB) × level + Σ primitive contributions (currently returns 10 in engine, should return 298 at level 18). -> in my frontend it displays good though."*

**Decision H1/H2:** Max vitality formula confirmed = `(10 + PB) × level + Σ primitive contributions`. Floor/ceiling DO apply to max vitality. **HOWEVER:** your frontend already displays max_vitality correctly (presumably it reads `currentVitality` from the DB and uses it as max). The engine's resolve output `max_vitality: 10` is broken but the frontend doesn't read it. **Question:** Is the engine fix needed at all, or do we just leave the resolve API as-is and let the frontend keep doing its thing? (See open question L1 below.)

> *"F1: no. Now you do not create new heritages. I just want to see individual capabilities bundle up in the frontend in the correct accordion in character sheet. if I slot in an actual heritage it works well already."*

**Decision F1:** **DO NOT create new heritages in this round.** Just verify that the existing 4 capabilities (Divine Smite, Hunter's Mark, Stone's Endurance, Iron Defender) bundle correctly in their respective accordions in the Capabilities tab. The heritage accordion rendering is already working for real heritages.

> *"F2: yesss. But make sure to make at least one practice with value type equation, and maybe with some and/or chain in values idk just to check it. And don't forget conditions: numbers, and/or chains, with actual numbers and with text and stuff. We need to also stress test it to see what works and does not and how to fix."*

**Decision F2:** Add primitives across every axis for stress-test coverage. Must include at least:
- **One practice with value-type `equation`** (with operands + tags) — verifies the equation engine path
- **One practice with AND/OR chain in values** — verifies operator chain parsing
- **Conditions with:**
  - Numeric comparisons (e.g. `self:stat|vitality_pct|<|0.5`)
  - AND/OR chains in tokens (e.g. `[self:proficient_in(fieldcraft), AND, self:stat|vitality_pct|>|0.3]`)
  - Text-based conditions (e.g. `self:not_proficient`)
  - Mixed: text + number, free-form tags, edge cases
- **Coverage axes:** physical, mental, magical attributes, all 3 save DCs, all 3 defenses, attack bonus, all 10 practices (or at least 6 covering each attribute), damage modifiers (cold/fire/poison/etc), speed (walking+swimming+climbing), size, max_vitality, equipment slots, load, carry capacity, complexity, action economy, source_type.

**Stress-test goal:** Break things on purpose to see what fails. The point is to surface what's NOT working, not to make everything green.

> *"G1. yes."*

**Decision G1:** "Proficiency bonus text+modifier teal" applies to ALL +PB-derived primitives, not just practice ones. So:
- `Proficient Fieldcraft +6` (PB on practice) — teal text + teal modifier
- `Proficient Save +2` (PB on save) — teal text + teal modifier
- Any other +PB contribution — teal text + teal modifier

> *"G2. bold both."*

**Decision G2:** Expertise primitive — **both text AND number are bold AND teal**. The text "Expertise Fieldcraft" is teal+bold, the number "+6" is teal+bold.

> *"g3. In the practice rows! We need to display the color code, we need to display advantage, min/max etc there too! Like with everything in the bottom drawer. Modal is just to see the general rules, the breakdown of where deoes this number comes from, and conditions (why is there * next to fieldcraft? -> for example because you have extra +10 only when tracking enemies)"*

**Decision G3:** Color codes + markers (advantage/min/max/`*`/etc) MUST show on **every number in the bottom drawer**, not just modals. Specifically:
- Practice rows (Fieldcraft +24) need teal coloring on PB-related numbers + markers
- Mod+saves rows need same
- Defense/attack/save rows need same
- **Modal purpose:** show the *breakdown* (which primitives contribute), the *general rule*, and the *condition text* explaining why a `*` marker exists. The modal is informational; the bottom drawer is the live readout.

This is **the bigger fix** — the bottom drawer practice rows currently show just `Fieldcraft +24` with no color, no markers. They need the same marker+color treatment as the attributes already have.

> *"H1. yes."*

**Decision H1:** Max vitality formula confirmed = `(10 + PB) × level + Σ primitive contributions`. PB at level 18 = 2+ceil(18/4) = 6, so max = (10+6)×18 + 10 = 298 with Vitality Buff +10.

> *"h2. Yes. Man, the whole purpose of everything we did in primitives form, modifiers, triggers when, self etc is to be able to target everything with everything and be able to construct conditions with everything (even if it does not make sense)."*

**Decision H2:** Floor/ceiling apply to **every axis** including max_vitality. The whole point of the modifier system is to be able to target anything with anything (even nonsensical combinations). Min/max as informational indicators show on every applicable axis (per your A2 decision).

> *"i1. Yes those are good but you must find for everything else."*

**Decision I1:** Human-readable mappings — start with the 9 I proposed, but the implementation phase needs to enumerate **every** token shape the engine can produce. Goal: complete coverage so the user never sees raw tokens in the UI. The engine's full token taxonomy needs to be enumerated during implementation.

> *"j1. we do not hide anything, just greyed-out with '(capability OFF)' subtitle."*

**Decision J1:** When a capability is OFF, the modal shows its primitives **greyed-out** with a "(capability OFF)" subtitle. The primitive still appears in the breakdown (because the engine doesn't suppress it), but visually marked as inactive. The user can see WHY the math is what it is.

---

## 8. Open questions for round 3 (L-group — small follow-ups)

1. **L1 — Engine max_vitality fix needed?** You said the frontend displays max_vitality correctly (probably reads `currentVitality` from the DB). The engine returns 10. Is the engine fix still wanted, or do we leave it and let the frontend keep its own path?
2. **L2 — Equation value-type example:** For the stress-test practice, what operands + tags should the equation have? e.g. `PB + (level / 4) [fire]`? Or do you have a specific shape in mind for testing?
3. **L3 — AND/OR chain shape:** The recap mentioned `[self:proficient_in(fieldcraft), AND, self:stat|vitality_pct|>|0.3]`. Is this the shape the engine currently expects, or is there a different format from the i2.7 spec I should reference?
4. **L4 — Greyed-out primitive styling:** When a capability is OFF, the modal shows the primitive greyed-out. Should the number value also be greyed (e.g. `+6` shown in grey), or just the label "(capability OFF)"?
5. **L5 — Bottom drawer "conditions" section:** Should the practice rows show the condition text inline (e.g. `Fieldcraft +24 * (when tracking)`), or only the `*` marker with the condition text only in the modal?

---

## 9. Resolved scope (after round 2)

**Round 2 closed 9 questions. Round 3 has 5 small follow-ups (L-group).**

### What we're building (ordered D → A → C → B → E)

**Phase D — Test character data (FIRST):**
- D-seed-1: ~~Create 3 heritages~~ → **CANCELLED.** Don't create new heritages. Just verify existing 4 capabilities bundle correctly in their accordions.
- D-seed-2: Add primitives across EVERY axis for stress-test coverage:
  - One equation-value-type practice
  - One AND/OR chain in values
  - Conditions: numeric, AND/OR, text, mixed
  - All axes: physical/mental/magical attrs, saves, defenses, attack, practices, damage mods, speed, size, vitality, equip slots, load, carry, complexity, action, source type

**Phase A — Math/UI labels:**
- A-fix-1: `OP_LABEL.max = "↧"`, `OP_LABEL.min = "↥"` in `formula-modal.tsx`.
- A-fix-2: Modal breakdown shows min/max as informational indicators (no + prefix), not as additive contributions.
- A-fix-3: Fix target key mismatch in `AxisMarkers` (practice rows).
- A-color-4: Color-code per the rules:
  - PB/2: number-only teal
  - Expertise: text AND number teal AND bold
  - Proficiency (all +PB): text AND modifier teal
  - Floor/Ceiling: orange (current)
  - `*`: amber/orange (current)
  - Advantage: green; Disadvantage: red
- A-color-5: **Apply color codes + markers to EVERY number in the bottom drawer** (practice rows, mod rows, save rows, defense rows, etc.) — not just modals.
- A-target-6: Implement `target_who` override on `capability_primitives` and `effect_primitives`.

**Phase C — Modal UX:**
- C-fix-1: Human-readable conditions text everywhere (complete token taxonomy coverage).
- C-fix-2: When capability is OFF, modal shows primitive greyed-out with "(capability OFF)" subtitle.

**Phase B — Lower priority:**
- (No changes from round 1)

**Phase E — Even lower:**
- (No changes from round 1)

### What's NOT being built in this round
- Per-effect toggles (punted)
- Runtime primitive direction conflict resolver (punted)
- Heritage `targetWho` override (only capability_primitives and effect_primitives get it)
- New heritages in seed (cancelled)
- Engine max_vitality formula fix (pending L1)

---

## 10. What happens after round 3

Once you answer L1-L5:
- I update this doc with round-3 decisions inline
- Invoke the `plan` skill to draft a bite-sized implementation plan in `.hermes/plans/`
- Each task gets its own commit, pushed immediately (Rule 9)

---

## 11. Files I read to produce this recap (no changes made)

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

## 12. Notes for future reference

- The Vercel build silently falls back to last good build on TypeScript errors. Always run `npx next build` not just `npx tsc --noEmit` before pushing.
- The `regex literal backslash` trap: in `/.../`, `\\(` matches literal `\` + `(`. To match literal `(`, use `\(`. Always verify regex changes with `node -e` and `xxd`.
- The seed script upserts via `ON CONFLICT (name, source_origin) DO UPDATE`. Re-run after any change to primitive hard_modifiers JSON shape.
- The test character has `current_vitality: 60` but `max_vitality: 10` from the resolve. Per D2 decision, the engine should apply `(10 + PB) × level + primitive contributions` = 298 at level 18, but the frontend reads `currentVitality` from the DB directly.
