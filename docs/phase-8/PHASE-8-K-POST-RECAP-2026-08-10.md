# Phase 8.K — POST Phase 8.J Visual Audit #2 — 2026-08-10

**Author:** Senku
**Source:** user feedback file `feedback_drawer_and_modals.md` (19 items)
plus 8 screenshots showing Tessy3 (existing character) and i2 Test Character.

**This file:** Catalogues the 19 issues you raised + scope for Phase 8.K.
Do NOT implement yet — wait for user decisions on scope cut + reopen-points.

---

## 1. Critical context — what changed since Phase 8.I

Phase 8.I shipped 17 commits. Phase 8.J shipped 4 commits. Combined these
made the **engine correct** and most modals render, but multiple regressions
slipped through and several long-standing engine rules were never built.

### What's actually working (verified live)

✅ Engine resolve API (`max_vitality=298`, conditions eval correctly)
✅ Practice modal — Conditions section at top, condition text readable
✅ Provenance breadcrumbs ("via Direct", "via Divine Smite")
✅ Color rules on practice rows (Proficient Fieldcraft + Expertise Fieldcraft both teal)
✅ Click condition text → JSON sub-modal
✅ Ceiling 18 row shows `18` not `+18 max` in practice modal
✅ Capability section with slotTab grouping (Lineage/Upbringing/Manifest)

### What's broken (19 items)

Group by severity. **Critical** = visible regression. **Architectural** = needs engine re-think.

---

## 2. Critical issues (visible regressions)

### K1 — Capabilities tab: capabilities are duplicated [CRITICAL]

**Screenshot (Tessy3):** `CAPABILITIES (3)` section shows 3 caps at top.
Then below, "Primitives (27)" + "Manifest (1)" + heritage accordion shows
"CAPABILITIES (2)" **again** with the same caps nested inside.

**User:** *"Don't you see we already have where to display things in heritages,
why duplicate it?"*

**Fix:** Delete the top-level "CAPABILITIES (N)" section. The capabilities
already render correctly under each heritage accordion (where slotTab
routes them). The `HeritageKindAccordion` already shows the capability
cards with Trigger/Active toggles + BU budget + version pills. **My Phase 8.J
add was redundant and broke the existing layout.**

**Action:**
1. Remove the new "Capabilities (N)" section I added in `character-sheet-view.tsx`
   (the `<details>` block with `(["LINEAGE", "UPBRINGING", "MANIFEST"])`).
2. Trust that `HeritageKindAccordion` (existing code) already renders caps.
3. For 0-heritage characters, the slotTab-based capability accordions should
   appear in a single "Capabilities" section without a heritage wrapper — but
   to avoid duplication, **only render that fallback when `heritageLinks.length === 0`**.

**Severity:** Critical (Tessy3 broken).

### K2 — Capability card missing BU budget, version, Trigger/Active toggle [CRITICAL]

**User:** *"Before they had the nested effects, they had the trigger and
active/inactive tag and the BU budget and they had version and a lot more....
They just weren't showing... Oh, you just added them again.. why??"*

**Hypothesis:** The `HeritageKindAccordion` already uses `CapabilityCard`
which has Trigger button + Active/Inactive toggle + BU budget + version pill.
But for the i2 Test Character (0 heritages), my new section bypasses
HeritageKindAccordion and renders a stripped-down card without these.

**Fix:** Same as K1 — use `HeritageKindAccordion` for 0-heritage chars too,
or extract `CapabilityCard` and use it directly in the fallback.

### K3 — Attribute card shows min/max TWICE (↑ 18 ↓ 18) [CRITICAL]

**Screenshot:** `PHYS PROF +6  ↓ 18  ↓ 18`

The character has `Ceiling 18` primitive only (no Floor 18). But the card
shows BOTH `↓ 18` and `↑ 18`. The floor `↑ 18` shouldn't be there.

**Hypothesis:** Either:
- A `findFloor` lookup is finding a primitive that isn't a floor
- The character got `Floor 18` somehow (look at Plating effect — it has
  `Floor 10` targeting a different axis)
- The `findFloor` defaults to `null` but the marker shows anyway

**Fix:** Audit `findFloor`/`findCeiling` in `bottom-sticky-bar.tsx`. Both
should return `null` when no matching primitive exists. Show marker only
when value is non-null.

### K4 — Practice rows show no advantage/disadvantage markers [CRITICAL]

**User:** *"I see no advantage, min/max next to any practice."*

The user expects `Communion +4 ⇈(2)`. Currently the practice rows show
only `Communion +4` with no markers. The reason is twofold:

1. The advantage/disadvantage primitives (e.g. "Advantage" — target `behavior.advantage`)
   target the **wrong axis**. They should target specific skills (like
   `skill_practice_check.communion`), not `behavior`.
2. Even if they did target the right axis, the practice row renderer
   needs to render AxisMarkers for `skill_practice_check.<practice>` —
   which the A3 fix in Phase 8.J should have handled, but maybe doesn't
   for the practice list rows.

**Fix:** Two parts:
1. **Re-author** the Advantage/Disadvantage primitives (see K8).
2. **Verify** AxisMarkers renders on practice list rows in the bottom
   drawer — not just in the modal.

### K5 — Practice modal ceiling shows "18" but attribute modal ceiling shows "+18" [CRITICAL]

**User:** *"In formula in modal for ceiling in practices it only shows
number not the identifier Unicode. In attribute it only shows +18 still...."*

I fixed `formula-modal.tsx` (attribute path) but the practice modal uses
its own `ContribListItem` which I also fixed. The user says attribute still
shows "+18" — meaning `formula-modal.tsx` may not be fixed in production
OR there's another path.

**Hypothesis:** The PHYS card (`↑ 18 ↓ 18`) is from a different component
(`ModSaveProvenanceModal` or the top bar), not `FormulaModal`. That component
may not be using `StepRow` and renders OP_LABEL `min/max` as "min"/"max"
plus `fmt(value) = +18`.

**Fix:** Audit all 4 modal paths:
- `FormulaModal` (attribute mod, save, vitality, pb)
- `PracticeDetailModal` (in bottom-sticky-bar)
- `ModSaveProvenanceModal` (PHYS mod+save combined)
- `BehaviorFormulaModal`

Make sure ALL of them omit `+` prefix and `min/max` label for ceiling/floor rows.

### K6 — Suppressed primitives still show value in modal [CRITICAL]

**Screenshot (Reason modal):** "Hunter Bonus +3" with "✗ suppressed" in
the conditions section. The +3 is still shown as if it contributes.

**Fix:** When `conditionActive === false`, the value should be greyed-out
(we have C3 logic but it's checking `offCapabilityIds`, not `conditionActive`).
Add `conditionActive === false` to the grey-out check.

### K7 — Color codes missing on practice/save rows [HIGH]

**User:** *"Things in practices and saves still not color codes correctly."*

The modal rows are color-coded (teal for Proficient/Expertise/PB Half).
But the **drawer rows** (the practice list in the bottom sticky bar)
don't have color rules.

**Fix:** Apply the same `isExpertiseName`/`isProficiencyName`/`isPbHalfValue`
checks to the practice list rows in the bottom drawer.

---

## 3. Architectural issues (need engine re-think)

### K8 — Advantage is a grant, not a behavior [ARCHITECTURAL]

**User:** *"Advantage I told you many times. It's a grant. And target it's
whatever it's targeting. I target practice/skill Communion. I add value type
keyword/text. I add [advantage]. That easy. Why behavior?"*

The current "Advantage" primitive targets `behavior.advantage`. The user
wants it to target a SPECIFIC AXIS (like `skill_practice_check.communion`)
with `value type keyword [advantage]`. The engine's `grant` operation would
fire on the target axis.

**Engine changes needed:**
1. **`grant` operation** must support `value` of shape `{ kind: "keyword", value: "advantage" }` (not just numeric).
2. The resolver must convert `grant + advantage` on `skill_practice_check.communion`
   into `behavior.advantage += 1` (specifically for that axis).
3. OR: the resolver adds the keyword to a per-axis `grantedKeywords` map,
   and `AxisMarkers` reads that map to render `⇈(N)`.

**Fix scope:** ~3 engine changes. Could be 1 commit but high-risk.

### K9 — `attack_bonus.physical/mental/magical` should be ONE axis [ARCHITECTURAL]

**User:** *"What is attack_bonus.physical? Do we have separate for magical
and mental? We should not ... There is one attack bonus that scales with
what attribute you are proficient in.... Same with save_dc.physical...
there is one save DC..."*

The current schema has 3 axes: `attack_bonus.physical`, `attack_bonus.mental`,
`attack_bonus.magical`. Same for `save_dc.`. The user wants ONE axis
(`attack_bonus`) that resolves to the proficient attribute's bonus.

**Engine changes:**
1. Define new target `attack_bonus` (no attribute suffix).
2. The resolver determines which attribute's modifier feeds in based on
   `character.attrProficient`.
3. Same for `save_dc`.

**Migration needed:** Update existing primitives that target
`attack_bonus.physical` → `attack_bonus`. Same for `save_dc`. Update
target registry. Update ATTR_TARGETS.

**Fix scope:** ~5 files touched, 2-3 commits, high-risk (affects math).

### K10 — Vitality ceiling/floor not showing in modal [HIGH]

**User:** *"Vitality ceiling not showing in modal nor the floor (from primitives)."*

The max_vitality formula path applies min/max limits, but the modal's
breakdown for vitality may not render `min`/`max` contributions as rows.

**Fix:** Audit the maxVitality modal path. Add `Vitality Floor` and
`Vitality Ceiling` rows when present.

### K11 — Awareness doesn't change when HP < 50% [CRITICAL]

**User:** *"Idk why but the conditions don't properly work. For example
the awareness does not change when below 50% HP....."*

The character is at HP 60/298 (20%) which IS below 50%. Iron Will should
fire (which adds +PB to physical defense). But the user expects awareness
to change — but the Iron Will primitive only adds to `defense.physical`,
not to awareness. **The expectation is wrong** OR there's a primitive
that should affect awareness but doesn't.

**Likely correct behavior:** Iron Will only adds to physical defense.
Awareness shouldn't change. **But the user's frustration is real** — they
expect HP-gated primitives to apply broadly.

**Fix:** Confirm Iron Will is only on `defense.physical`. If user wants
HP-gated bonuses on practices, they need to author one (e.g. "Adrenaline
Rush: +1 to all practices when HP < 50%").

### K12 — Damage modifier primitives broken (poison vulnerability etc.) [HIGH]

**User:** *"the backpack primitive with carry capacity not working......
I'm what is magical defense in defense magic buff? If anything should be
like +1 to save DC when source is magic...."*

And K14: *"Resistances vulnerabilities and poison immunity we can keep
how you did but in reality most people will do like 9. What changes
damage type poison keyword vulnerability."*

The seed has `Defense Magic Buff` targeting `defense.magical` which is
WRONG — it should target `save_dc.magical`. Same for damage modifiers
(needing `value type keyword [vulnerability]` instead of `add value 0.5`).

**Fix:**
1. Update `Defense Magic Buff` primitive to target `save_dc.magical`.
2. Add new primitive format for damage modifiers:
   `target: damage_modifier.poison, op: grant, value: {kind:keyword, value:"vulnerability"}`.
3. Verify `Backpack` primitive targets `carry_capacity` correctly.

### K13 — Equations don't display in page or preview modal [HIGH]

**User:** *"Equations do not display in page not in preview modal anymore
and they should be pretty formatted not just text."*

The Prowess Equation primitive has `value: {kind:"equation", operands:[...]}`.
The resolver evaluates it correctly (returns the value), but the UI
shows raw JSON `{kind:"equation", operands:[...]}` instead of formatted
`PB + 2`.

**Fix:** Add an `formatEquation` helper in `condition-dictionary.tsx` that
renders `{kind:"equation", operands:[{kind:"derived",which:"pb"}, {kind:"number",value:2}]}`
as `PB + 2` or `[fire] tag` as a colored chip. Apply in the modal row.

### K14 — Size Large primitive wrong format [HIGH]

**User:** *"Size. Large not working either. It should be what changes, size,
sub targets empty. Add modifier set to value type keyword [large]"*

Current `Size.Large` primitive probably has wrong target. Should be:
```
target: what_changes.size
op: set
value: {kind: keyword, value: "large"}
```

Or maybe simpler: `target: size, op: set, value: "large"` with the
engine recognizing the keyword.

**Fix:** Update Size primitive format + verify engine handles `set` op
with keyword value.

### K15 — Equip slot primitive not working [HIGH]

**User:** *"Equip slot still not working"*

Need to investigate what primitive exists, what target it has, and why
it's not contributing.

**Fix:** Audit equip slot primitives. Update target to `equip_slot.<name>`
or similar axis. Verify engine knows the axis.

### K16 — Force Source primitive wrong format [HIGH]

**User:** *"Force source is also weird, if anything just like 9."*

Same as K14 — format wrong. Should use `keyword` value type.

### K17 — AND/OR chips instead of inline text [MEDIUM]

**User:** *"In conditions can we make the AND and OR like chips not like
simple text in chains? In modals?"*

Currently the condition text reads:
`Tracking an active mark OR Not proficient`

User wants chips: `[Tracking an active mark] [OR] [Not proficient]`

**Fix:** Update the conditions rendering to use chips with AND/OR as
distinct styled elements (e.g. AND in cyan, OR in amber).

### K18 — Lighten primitive is for items, not character [LOW]

**User:** *"Lighten primitive is ok, but it's for items not for character....."*

If the seed has Lighten slotted on the test character, it shouldn't be.
Remove from character slot. Items get Lighten via item grants.

---

## 4. Decisions needed for round 1

The 19 items are too many to tackle in one pass. Let me group them into
P0 (must fix now), P1 (next pass), P2 (later) and ask you to confirm.

### K-Scope — Order of operations

| Item | Severity | Effort |
|---|---|---|
| K1 — Remove duplicate Capabilities section | Critical | 1 commit |
| K2 — Restore BU/version/Trigger on capability cards | Critical | 1 commit (uses existing CapabilityCard) |
| K3 — Fix `↑ 18 ↓ 18` duplicate marker | Critical | 1 commit |
| K4 — Practice rows: no advantage markers | Critical (but K8 is bigger) | depends on K8 |
| K5 — Practice modal + attribute modal ceiling Unicode | Critical | 1 commit (audit all 4 modal paths) |
| K6 — Suppressed primitives greyed-out in modal | Critical | 1 commit |
| K7 — Color codes on practice/save rows in drawer | High | 1 commit |
| K8 — Advantage as grant (not behavior) | Architectural | 3 commits |
| K9 — `attack_bonus` and `save_dc` single axis | Architectural | 3 commits |
| K10 — Vitality ceiling/floor in modal | High | 1 commit |
| K11 — Confirm Iron Will scope (no change) | Critical (explanation) | 0 commits |
| K12 — Defense Magic Buff target fix + damage keyword primitives | High | 2 commits |
| K13 — Equations formatted display | High | 1 commit |
| K14 — Size primitive format | High | 1 commit |
| K15 — Equip slot primitive | High | 2 commits (audit + format) |
| K16 — Force Source primitive format | High | 1 commit |
| K17 — AND/OR chips in conditions | Medium | 1 commit |
| K18 — Remove Lighten from character | Low | 1 commit |
| Total | | ~21 commits |

### Decisions

**D-K1 — Phase 8.K scope cut**

Options:
- **(a)** Critical + High (skip K8, K9, K15, K16, K18 for later) = 11 commits
- **(b)** Critical only = 6 commits (gets the page working without features)
- **(c)** Everything (full P0+P1+P2) = 21 commits (long session)

**Recommended:** (a) — get the page rendering correctly + K8 (advantage
as grant) since K4 depends on it. Skip K9 (architectural) and K15/K16 (need
research first).

**D-K2 — K8 implementation order**

For the advantage-as-grant feature, where to start?

Options:
- **(a)** Engine first (add `grant` op with keyword value, then re-seed)
- **(b)** Schema first (add new axis `behavior_axis.advantage` per target,
  migrate primitives)
- **(c)** UI first (render ⇈/⇊ in practice list rows + drawer, no engine change yet)

**Recommended:** (c) — UI first to confirm visual placement, then engine,
then re-seed. But it means K4 (no markers in practice list rows) won't be
fully solved until engine work lands.

**D-K3 — K5 (Unicode on all modal paths)**

User's complaint: attribute modal still shows "+18" not "↧ 18" while
practice modal shows "18" correctly. Which is the truth?

Options:
- **(a)** I misread the screenshot — `formula-modal.tsx` is fixed in production
- **(b)** There are 2+ paths and one wasn't fixed
- **(c)** Build cache: Vercel hasn't deployed the latest commit

**Recommended:** (b) — need to audit all 4 modal paths.

**D-K4 — K9 (single attack_bonus / save_dc) scope**

Big architectural change. Defer or tackle now?

Options:
- **(a)** Tackle now (engine + schema + migration + re-seed)
- **(b)** Defer to Phase 8.L (just note in TODO)

**Recommended:** (b) — defer. It's a 3-commit piece of work that doesn't
fix any visual issue today. The per-attribute versions work (even if
wrong per user's spec).

---

## 5. Next step

Pick D-K1, D-K2, D-K3, D-K4. Once decided I write the plan and start.

If you want to skip the recap and just say "go" with my recommendations
(a, c, b, b), I'll do that.
