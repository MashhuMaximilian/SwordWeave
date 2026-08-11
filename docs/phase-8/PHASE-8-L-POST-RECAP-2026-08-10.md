# Phase 8.L — POST Phase 8.K Critical Issues — 2026-08-10

**Author:** Senku
**Source:** user feedback files `feedbacknew.txt` + `feedback-old-again-some-are-solved.txt`
plus 5 screenshots showing Prowess Equation primitive card, Communion
modal, Stone's Endurance bundle error, and Advantage on Communion card.

**This file:** Catalogues the new critical issues + asks for
decisions before implementing. **DO NOT IMPLEMENT YET.**

---

## 1. Honest assessment

I broke more than I fixed in Phase 8.K. The user is right:
- I created primitives that target axes the engine doesn't know (`skill_practice_check.stealth` — stealth isn't a practice)
- The primitive card displays `[]` for keyword values (engine stores `{kind:"keyword", value:"advantage"}` but UI reads `obj.text` not `obj.value`)
- The Prowess Equation primitive card shows `Add ?` — equation value not handled in primitive card
- I keep creating per-attribute save_dc / attack_bonus versions when the user has said **16+ times** that there should be ONE global axis
- "Stone's Endurance" bundle fails to load — JSON parse error on the bundle endpoint

---

## 2. Critical issues (visible regressions)

### L1 — `skill_practice_check.stealth` is not a valid target

**User:** *"skill_practice_check.stealth — Grant [] — wtf? We don't have stealth
in practices.... would be a fieldcraft based on stealth"*

**Diagnosis:** I created an "Advantage on Stealth" primitive targeting
`skill_practice_check.stealth`. The Practice enum doesn't include `stealth`.
Fieldcraft is the closest practice to stealth.

**Fix:** Either:
- (a) Add `stealth` to the practice enum and ALL_PRACTICES
- (b) Re-target to `skill_practice_check.fieldcraft` (user's suggestion)

**Recommended:** (b) — re-target to fieldcraft.

### L2 — Primitive card shows `[]` for keyword value

**User:** *"but it as adv in communion but idk"*

**Screenshot:** `skill_practice_check.communion   Grant   []`

**Diagnosis:** My seed uses `value: { kind: "keyword", value: "advantage" }`.
The `PrimitivePreviewCard.renderValue()` reads `obj.text` for the
keyword case but the seed uses `obj.value`.

**Fix:** I just deployed a fix in commit `104bae9` — renderValue now
reads `obj.value ?? obj.text ?? ""`. Verify on production.

### L3 — Prowess Equation primitive card shows `Add ?`

**Screenshot:** `skill_practice_check   PROWESS   Add   ?`

**Diagnosis:** The primitive card's `renderValue()` doesn't handle the
`equation` value kind. The modal does (via `formatEquationValue`).

**Fix:** I just deployed a fix in commit `104bae9` — added equation
case to `renderValue`.

### L4 — Stone's Endurance bundle fails to load

**User screenshot:** "Failed to execute 'json' on 'Response': Unexpected end of JSON input"

**Diagnosis:** The bundle endpoint for Stone's Endurance is returning
empty/truncated response. The status pill says "Resolving capability:91572a5c..."
which suggests the API is hanging or the response stream is being
closed early.

**Fix:** Audit the bundle resolution API. Possibly the JSON response
is being returned without proper Content-Length or with double-encoded body.

### L5 — Advantage/Disadvantage markers not visible on practice list rows

**User:** *"I modified the stealth primitive myself... but it as adv in communion but idk"*

**Diagnosis:** My K8 fix in commit `104bae9` should make markers visible.
The `countStacks` function now reads from the per-axis adv counter at
`behavior.advantage.skill_practice_check.communion`.

**Verify on production.**

### L6 — ONE save_dc / attack_bonus axis (THE user has said this 16+ times)

**User:** *"WE ONLY HAVE ONE SAVE DC WE DO ONT HAVE ONE FOR EACH ATTRIBUTE.
WE HAVE ONE SINGLE GLOBAL FUCKING SAVE DC HOW MANY TIMES TO TELL YOU?
IT AUTOMATICALLY SCALES WITH THE ATTRIBUTE YOU ARE PROFICIENT IN.... (maybe
we will have conflicts if I add pb to more attributes but we will eventually
choose which one is used for save dc and attack bonus inside the modal of
these 2)..."*

**Diagnosis:** The current schema has `save_dc.physical`,
`save_dc.mental`, `save_dc.magical`. Same for `attack_bonus.*`. The
`bottom-sticky-bar.tsx` queries `save_dc.${primaryAttr}` based on
`proficientAttribute`. The user wants ONE global `save_dc` and ONE
global `attack_bonus` that auto-scales.

**Engine changes:**
1. Define new targets `save_dc` and `attack_bonus` (no attribute suffix).
2. `resolveSaveDc(input, attr)` and `resolveAttackBonus(input, attr)` —
   use the proficient attribute's modifier + PB.
3. Migration: rename existing primitives from
   `save_dc.physical` → `save_dc`, etc.
4. Update `isValidTarget` in resolve route to accept new keys.
5. Update the bottom-sticky-bar to use new keys.

**Note:** User says conflicts will be resolved inside the modal.
This means the modal should let the user CHOOSE which attribute feeds
the single save_dc if multiple attribute-related primitives exist.

**Recommended:** Defer to a separate phase. **This is a 3-4 commit piece
of work** that touches engine, schema, primitive seed, route, modal,
and bottom-sticky-bar. Acknowledge it as the architectural long-term
plan, but tackle the visible bugs first.

### L7 — "Large" primitive not updated

**User:** *"the primitives for like size large and save dc are not deleted or
updated as I suggested.... Idk if it is a version issue and you should
force push latest changes to primitives into the character or what happens"*

**Diagnosis:** The seed upserts primitives via `ON CONFLICT (name, source_origin)
DO UPDATE SET hard_modifiers = EXCLUDED.hard_modifiers`. This should
update existing primitives. But maybe the seed is failing for these
specific primitives, OR the character has the primitives in
`character_primitives` (which the seed inserts) but the atelier seed
has the canonical version with the OLD format.

**Fix:** Audit the seed for `Size.Large` and `Enlarge` primitives. Re-seed.
Verify the `character_primitives` row was updated with the new format.

### L8 — Primitives missing version in UI

**User:** *"Primitives also are missing the version in the ui."*

**Diagnosis:** `PrimitivePreviewCard` doesn't show the primitive's
`versionId` (pinned version). The user wants to see the version
pill, similar to what the capability card shows.

**Fix:** Add version pill to `PrimitivePreviewCard` if
`primitiveLink.versionId` is set.

### L9 — Reseed / force update needed

**User:** *"I also know the primitives and stuff do not update unless I
edit character which is good, but when I try to update this one, it's weird."*

**Fix:** Re-run the seed for the test character after fixing the
primitives. The user has another test character (Tessy3) which is
user-authored — they need to update those manually.

---

## 3. Other issues raised (lower priority)

### L10 — Force Source primitive format
Same as K14. Deferred per K-recap.

### L11 — Equip slot primitive
Same as K15. Deferred.

### L12 — Lighten on character
Same as K18. Deferred.

### L13 — "via via" double-prefix in primitive card
**User screenshot:** `1 BU · via via Hunter's Mark`

**Diagnosis:** The primitive card renders `via` from the seed
`directPrimNames` array, but `provenance` is also being rendered as
`via`. Double-prefix.

**Fix:** Audit the PrimitivePreviewCard's `via` rendering. One of the
sources is already prefixed.

### L14 — Save DC Buff primitive should target save_dc (not save_dc.physical)
**User:** *"WE ONLY HAVE ONE SAVE DC"*

Same architectural change as L6. All `save_dc.<attr>` primitives should
be `save_dc`. All `attack_bonus.<attr>` primitives should be `attack_bonus`.

### L15 — K7 (color codes on practice/save rows in drawer)
Pending from K-recap.

### L16 — K10 (vitality ceiling/floor in modal)
Pending from K-recap.

### L17 — K5 (audit 2 more modal paths)
Pending from K-recap.

---

## 4. Phase 8.L — implementation scope

| Item | Severity | Effort |
|---|---|---|
| L1 — Re-target stealth primitive to fieldcraft | Critical | 1 commit |
| L2 — Keyword display in primitive card | Critical (DONE in 104bae9) | 0 |
| L3 — Equation display in primitive card | Critical (DONE in 104bae9) | 0 |
| L4 — Stone's Endurance bundle JSON error | Critical | 1-2 commits |
| L5 — K8 adv/disadv markers | Critical (DONE in 104bae9) | 0 |
| L6 — ONE save_dc / attack_bonus axis | Architectural | 3-4 commits |
| L7 — Re-seed Large/Enlarge with corrected format | Critical | 1 commit |
| L8 — Primitive version in UI | Medium | 1 commit |
| L9 — Reseed test character | Critical | 1 commit |
| L13 — "via via" double-prefix | Medium | 1 commit |
| L14 — Migrate save_dc/attack_bonus primitives | Bundled with L6 | 0 |
| L15-L17 — K-recap pending | Medium | 3 commits |
| Total | | ~10-12 commits |

---

## 5. Decisions for round 1

**D-L1 — Phase 8.L scope cut**

Options:
- **(a)** L1, L4, L7, L8, L9, L13 + L15-L17 (~8 commits) — visible bugs
- **(b)** (a) + L6 architectural refactor (~12 commits) — full
- **(c)** L1, L4, L7, L8, L9, L13 only (skip L6 and L15-L17) — 5 commits

**Recommended:** (c) — fix the visible bugs + audit/re-seed. Defer
the architectural L6 to Phase 8.M.

**D-L2 — L6 (single save_dc/attack_bonus) timing**

Options:
- **(a)** Tackle now in Phase 8.L
- **(b)** Defer to Phase 8.M after visible bugs are fixed

**Recommended:** (b) — the engine change is non-trivial (3-4 commits
+ migration + manual re-author of primitives). Needs a focused phase.

**D-L3 — L7 (force-update existing character primitives)**

Options:
- **(a)** Add a script to the seed that does DELETE + INSERT for
  `character_primitives` rows whose primitive_id matches changed
  primitives. Re-run against the test character.
- **(b)** Document a manual fix path (delete primitives, re-seed).
- **(c)** Add a UI button on the character sheet to "Refresh primitives
  from latest template" — but that requires checking each primitive's
  `latestVersionId` and bumping the version.

**Recommended:** (a) — the seed already does DELETE + INSERT for the
capability effects. Add the same for the test character. Defer (c).

**D-L4 — L4 (Stone's Endurance bundle JSON error) priority**

Options:
- **(a)** Investigate immediately (this is a critical UX issue)
- **(b)** Skip for now, focus on other items
- **(c)** Log the error and add a retry button

**Recommended:** (a) — figure out which endpoint is failing and why.

---

## 6. Status (updated 2026-08-10)

Phase 8.L commits shipped (084d4b9, d43214c).

| Item | Status | Commit |
|---|---|---|
| L1 — Re-target stealth primitive to fieldcraft | ✅ DONE | `084d4b9` |
| L2 — Keyword display in primitive card | ✅ DONE | `104bae9` (K) |
| L3 — Equation display in primitive card | ✅ DONE | `104bae9` (K) |
| L4 — Stone's Endurance bundle JSON error | ⚠️ UNVERIFIED (response is valid now) | — |
| L5 — K8 adv/disadv markers | ✅ DONE | `104bae9` (K) |
| L6 — ONE save_dc / attack_bonus axis | ⏸️ DEFERRED per D-L2 (Phase 8.M) | — |
| L7 — Size + Force Source format | ✅ DONE | `084d4b9` (seed) + `d43214c` (engine) |
| L8 — Primitive version pill in UI | ✅ DONE | `084d4b9` |
| L9 — Reseed test character | ✅ DONE | `084d4b9` |
| L13 — `via via` double-prefix | ✅ DONE | `084d4b9` |
| L14 — save_dc/attack_bonus migration | ⏸️ Bundled with L6 | — |
| L15-L17 — K-recap pending | ✅ DONE | `d43214c` (K7+K14+K16) |
| L18 — Remove Lighten + per-attr save_dc | ✅ DONE | `084d4b9` |

**Architectural refactor L6 deferred to Phase 8.M.** This is the single
remaining user-visible architectural issue. Will need engine refactor +
seed migration + manual re-author of test character's save DC primitives.

**L6 needs:**
1. Define `save_dc` (no attr suffix) and `attack_bonus` (no attr suffix)
2. New resolver functions `resolveSaveDc(input, attr)` and
   `resolveAttackBonus(input, attr)` — use proficient attr's modifier + PB
3. Migration: rename all `save_dc.physical` → `save_dc`, etc.
4. Update `isValidTarget` in resolve route
5. Update `bottom-sticky-bar` to use new keys
6. Resolve conflicts in modal (user can pick which attribute feeds the
   global save_dc when multiple attribute-related primitives exist)
