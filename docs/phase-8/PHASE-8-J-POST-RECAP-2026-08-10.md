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

## 5. Open decisions for round 1

### D-1. Capability accordion layout

When a capability is shown without a heritage (character-level direct
capability), what section heading does it use?

Options:
- **(a)** "Character-level capabilities" (single section above heritage accordions)
- **(b)** "Capabilities" with each cap as a top-level accordion (no parent group)
- **(c)** "Direct" (since the engine has `kind: "direct" | "heritage" | "capability" | "effect"`)

**Recommended:** (b) — capabilities already have their own accordion
widget, no need to nest them.

### D-2. Practice row display in bottom drawer

Currently the practice row shows: `Fieldcraft   +24`

What's the final format?

Options:
- **(a)** `Fieldcraft   +24   *   ⇈` (markers next to number)
- **(b)** `Fieldcraft   +24*` (asterisk as superscript)
- **(c)** `Fieldcraft   +24   (3 active)` (count of active primitives)

**Recommended:** (a) — matches AxisMarkers component pattern, consistent
with attribute/practice row markers.

### D-3. Provenance breadcrumb format

When rendering "where this primitive came from":

Options:
- **(a)** Single line under name: `via Heritage 'Elf' > Capability 'Keen Senses' > Effect 'Darkvision'`
- **(b)** Icon chain: `[heritage] > [capability] > [effect]` (icons instead of words)
- **(c)** Just one level: `via Capability 'Divine Smite'` (drop empty segments)

**Recommended:** (c) — terse, only shows what's actually set.

### D-4. Modal compactness target

User said "make everything more compact maybe font size smaller".

Options:
- **(a)** `text-sm` → `text-xs` for formula text + calculation line
- **(b)** Reduce padding `p-3` → `p-2` everywhere
- **(c)** Both (a) and (b)

**Recommended:** (c) — the modal is too tall on mobile.

### D-5. Conditions section placement

When user opens the modal, where should the Conditions section appear?

Options:
- **(a)** Top, before the breakdown (so user sees WHY before HOW)
- **(b)** Bottom, after the breakdown (current implementation)
- **(c)** Only visible when `*` is shown — collapsed by default

**Recommended:** (a) — the user explicitly said "first things up should be
the conditions" and asked "Why do I have * like the primitive 'advantage
when condition'?".

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
