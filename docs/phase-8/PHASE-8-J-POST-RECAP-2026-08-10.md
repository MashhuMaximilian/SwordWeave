# Phase 8.J — POST Phase 8.I Visual Audit — 2026-08-10

**Author:** Senku
**Source of truth:** `PHASE-8-I-POST-RECAP-2026-08-10.md` (Phase 8.I landed 17/17 tasks).
**This file:** Visual audit of what Phase 8.I shipped vs what the user can
actually see on the live sheet + modals. **Captures every remaining gap
visible in the screenshots the user pasted.**

---

## 1. What works (verified on production)

✅ Condition evaluation (Expertise, Iron Will, Hunter Bonus, Reason, Knowledge)
✅ Math is correct: `max_vitality = 298`, `attribute.physical = 2`, `skill_practice_check.fieldcraft = 12`
✅ Modal shows the orange `*` marker next to gated totals
✅ Color rules applied: PB (proficient) shows teal in PB-row breakdowns (PHYSICAL save row "PB (proficient) +6" rendered with teal hue)
✅ ↧ floor/ceiling marker visible on PHYSICAL modifier header (`↓ 18`)
✅ Bottom drawer shows Behavior Variables section with Advantage +1, Disadvantage +1, Legendary Resistance
✅ 46 primitives in the Capabilities tab accordion (count is correct)
✅ Engineering characters: PC has 0 heritages + 4 capabilities + 5 effects in DB
✅ C1 human-readable conditions emit correctly through engine (verified in resolve output)
✅ Conditions dictionary has 16+ token patterns mapped

---

## 2. What is broken / missing (visual audit)

These are the gaps visible in the screenshots and inferred from the user's
exact complaints. **Group M (Modal), G (Capabilities page), D (Drawer).**

### M1 — Modal: `max` literal still showing on ceiling rows

**Screenshot:** fieldcraft modal shows `Ceiling 18   max   +18`.

The OP_LABEL fix landed (`max: "↧"`) but the modal STILL shows the literal
word `max`. The PHYSICAL modal (different target) correctly omits it.

**Hypothesis:** The fieldcraft modal is rendering through a different code
path (`PracticeRowModal` or `contributionsToSteps`) that builds the row
inline rather than via `StepRow` — and that path doesn't apply the
min/max-no-prefix change.

**Action:** Find the inline render and apply same fix.

### M2 — Modal: missing Conditions section

**All modals:** The `*` appears next to the total but there is NO
explanation of what condition it's tracking. The user opens the modal and
sees `+12 *` with no visible "why does this have a star?" answer.

**Action:** Conditions section in `formula-modal.tsx` exists
(`renderConditionsSection`) but is not being called by every modal
entry point. The practice-detail modal likely uses a different breakdown
that doesn't include the condition section.

### M3 — Modal: provenance chain missing per row

**All modals:** No row shows "via Heritage > Capability > Effect" breadcrumb.
The `provenance` field exists on `ModifierContribution` (capabilityName +
effectName + heritageName) but is not rendered in the breakdown rows.

**Action:** Render the provenance breadcrumb under each row's primitive
name. Format: `via {heritageName} > {capabilityName} > {effectName}` (omit
empty segments).

### M4 — Modal: wrong practice name in calculation line

**Awareness modal:** Calculation says `+5 (practice primitives)
(fieldcraft-specific)` but Awareness is a MENTAL practice, not fieldcraft.
The hardcoded label "fieldcraft-specific" is wrong.

**Action:** Use the dynamic practice name from the breakdown context, not
a hardcoded string.

### M5 — Modal: compactness

User says the modal needs smaller font size. The formula text and
calculation lines are big and waste space.

**Action:** Drop from `text-sm` (14px) to `text-xs` (12px) on
formula/calculation blocks. Reduce padding from `p-3` to `p-2`.

### M6 — Modal: primitive rows still have `via` breadcrumb missing for some

Some rows in the practice modal show `via` text (the small grey line below
the primitive name). But not all rows do, even though all primitives
should have provenance. The `via` line might be hidden when the row
renders through `StepRow` (the new compact row).

**Action:** Verify `via` is always passed and rendered.

### M7 — Modal: AWARENESS calculation says `(fieldcraft-specific)` literally

This is the worst offender — `fieldcraft` is a specific practice, but
this is the Awareness modal. The string is hardcoded somewhere.

**Action:** Grep for `(fieldcraft-specific)` and replace with dynamic
`(${practiceName}-specific)`.

---

### G1 — Capabilities tab: no heritage accordions visible

The Capabilities tab shows only the "Primitives (46)" accordion. NO
heritage accordions. NO capability accordions. The character has 0
heritages in DB but DOES have 4 capabilities attached to the character
slot table (`characterCapabilities`).

**Hypothesis:** The Capabilities tab logic only renders heritage
accordions, ignoring character-level capabilities.

**Action:** Render capability accordions at the top level (above the
Primitives accordion), one per character_capabilities row. Each
capability accordion should expose:
- Toggle (active/passive state, derived from localStorage)
- Direct primitives (`capability_primitives` table)
- Nested effects (one sub-accordion per effect, with `effect_primitives`)

### G2 — Capabilities tab: even if no heritages, show capabilities

Per user's recap G1 round 1: "If I slot in an actual heritage it works
well already." So heritages render fine when present. But capabilities
without heritages (direct character-level caps) aren't surfaced.

**Action:** Same as G1 — show all `characterCapabilities` rows as
accordions, regardless of heritage presence.

---

### D1 — Drawer: Advantage/Disadvantage label is ambiguous

**Screenshot:** `Advantage +1, Disadvantage +1` shown as plain text.
User can't tell if "+1" is the value or the stack count.

**Hypothesis:** The behavior variables section uses a generic chip
renderer that displays `+{value}` for everything. With `advantage` and
`disadvantage` the value IS the stack count (1 stack of advantage, 2
stacks of advantage, etc.) — not an additive modifier.

**Action:** Use a different label format for behavior variables:
`Advantage ⇈(1)` (with marker icon, count in parens). Same as our
AxisMarkers logic but applied to behavior row chips.

### D2 — Drawer: no ⇈/⇊ marker icons visible

User's concern: "Idfk why advantage disadvantage is low there?"

Even though A11 hides stacks of 1, a count of 1 should STILL show the
icon to disambiguate "this is behavior, not value". So D1 and this are
the same fix.

**Action:** Show `⇈(N)` for any N≥1 on behavior variables. (Revert A11
only for behavior variables; keep hiding for axis markers.)

---

## 3. What was missing from Phase 8.I recap

Looking at the screenshots vs my Phase 8.I recap, I missed:

| Task I missed | Severity |
|---|---|
| M1: `max` literal fix on practice modal (different code path than PHYSICAL) | High — visible regression |
| M2: Conditions section call site in practice-detail modal | High — core UX expectation |
| M3: Provenance breadcrumb rendering per row | High — user explicitly asked for "where is this from" |
| M4: Wrong practice name in calculation line | Medium — wrong info is shown |
| M5: Modal compactness (font size) | Medium — UX |
| G1: Capabilities tab shows character-level capabilities (not just heritage) | High — empty page |
| G2: Capabilities tab logic for 0 heritages | High — same as G1 |
| D1/D2: Behavior variables need ⇈(N) markers | Medium — UX clarity |

I also did NOT do:
- Visual indicators on practice list rows (the `*` marker, ⇈, ⇊). The
  AxisMarkers fix (A3) only fixed the lookup key — the practice LIST
  rows in the bottom drawer don't render AxisMarkers yet. They show
  just `Fieldcraft +24` with no marker, no color hint.
- Rendering actual provenance strings. My engine code passes
  `provenance` on `ModifierContribution` but the modal row doesn't
  display it. Same for `originCapabilityId` (only used for OFF-grey).

---

## 4. Scope for Phase 8.J

| Group | Tasks | Priority |
|---|---|---|
| **M — Modal polish** | M1, M2, M3, M4, M5, M6, M7 | P0 — visible regressions |
| **G — Capabilities tab** | G1, G2 | P0 — empty page is critical |
| **D — Drawer clarity** | D1, D2 | P1 — UX clarity |
| **P — Practice rows in drawer** | Render AxisMarkers + color rules on the practice list rows | P1 |
| **A — Apply markers everywhere** | Conditional + min/max markers should be visible on every number in drawer | P1 |

That's 11 implementation tasks. Probably 12-15 commits. Each task = one
commit + immediate push per Rule 9.

---

## 5. Decisions confirmed (your feedback round 1, 2026-08-10)

### D-1. Capability accordion layout — **(b)**

> *"D-1 -> b..... man we discussed about this. So, in character edit modal
> I can put capabilities direct and from heritages. But they should get
> placed in the correct accordion based on what tab in the edit modal
> they were placed. I guess from ui this is good, but since this ch is
> made in db idk....We already have accordions in the ui in character
> sheet...."*

**Decision:** Each capability is its own top-level accordion (no parent
group). The accordion title comes from `slotTab` on `characterCapabilities`
(when set by the edit modal tab selector — "Manifest", "Lineage", etc.).
The tab determines the accordion placement. UI already handles this; the
DB-side test character just needs slotTab values populated.

**Action:**
1. Inspect `characterCapabilities.slotTab` — confirm the column exists.
2. For the test character, update `slotTab` on the 4 capabilities to
   match their natural slot (Hunter's Mark → "Upbringing", Divine Smite →
   "Manifest", Stone's Endurance → "Lineage", Iron Defender → "Manifest").
3. In the capabilities tab render, group capabilities by `slotTab` value
   and render an accordion per group.

### D-2. Practice row display — **(a), adv/disadv first then `*`**

> *"a but adv/diadv first then *. If more, * is also last"*

**Decision:** Render order is `+N ⇈(N) ⇊(N) *` (advantage count,
disadvantage count, condition asterisk). When multiple markers, `*` is
always last.

**Action:** In AxisMarkers render, ensure the order is fixed: adv →
disadv → floor/ceiling → `*`.

### D-3. Provenance breadcrumb format — **(a), full chain**

> *"a. Full chain. a character may have multiple heritages or multiple
> direct capabilities in heritage tab (Like I could have a primitive from
> capability in heritage or from an effect within a capability within a
> Lineage within lineage accordion..."*

**Decision:** Always render the full chain. Empty segments are still
shown as `<empty>` (or `Direct` for character-level caps). Format:
`via <heritageName> > <capabilityName> > <effectName>`.

**Action:** Render `via Heritage 'Elf' > Capability 'Keen Senses' >
Effect 'Darkvision'` regardless of how deep the nesting is. When a
segment is empty, render it as `Direct` (or `Capability 'X' > Effect 'Y'`
when heritage is empty).

### D-4. Modal compactness — **(c), both**

> *"C both"*

**Decision:** `text-sm` → `text-xs` on formula/calculation blocks. Reduce
padding from `p-3` to `p-2` on every section.

**Action:** Apply both globally in `formula-modal.tsx`. Also reduce the
max-width of the modal from `max-w-lg` to `max-w-md` so it occupies less
horizontal space.

### D-5. Conditions section placement — **(a), top**

> *"A top"*

**Decision:** Conditions section appears at the TOP of the modal, before
the breakdown. User sees the "why" before the "how".

**Action:** Move `renderConditionsSection` call to render before
`breakdown.map(StepRow)`. When `*` is shown but conditions section is
empty (e.g. `conditionComputable=false`), still render the section with
a fallback "Condition not computable — value shown with `*` for awareness".

---

## 6. State

This recap supersedes the Phase 8.I recap for follow-up work. The 13
commits from Phase 8.I remain deployed. This file does NOT close any
tasks — it only documents what's broken so we can plan Phase 8.J.

**Next step:** User picks one option per letter (D-1 through D-5), then I
write the implementation plan for Phase 8.J.

---

## 7. Files likely to change (estimate)

- `src/components/characters/formula-modal.tsx` — modal layout, conditions section, provenance, compactness
- `src/components/characters/bottom-sticky-bar.tsx` — practice row markers, behavior variable markers
- `src/components/characters/character-sheet-view.tsx` — capabilities tab render
- `src/components/characters/practice-row-modal.tsx` (if exists) — practice-specific modal fix
- `src/lib/engine/provenance-formatter.ts` (new) — helper for breadcrumb strings
- `src/components/characters/capability-accordion.tsx` — extract accordion into own file

No DB changes. No engine changes. Pure UI work.
