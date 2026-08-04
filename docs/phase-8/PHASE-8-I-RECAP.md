# Phase 8.I — Engine Math Cluster (Modifiers → Numbers + Tags)

**Author:** Senku
**For:** Mashu — review & answer the open questions before any implementation work
**Status:** 🟡 Recap + question-collection phase. No code changes yet.
**Started:** 2026-08-04
**Origin:** Session I from the master plan (post-Sessions G + H which closed on 2026-08-04)

---

## What this phase is, in one sentence

Translate **every modifier** a character has access to (from slotted primitives, heritage-bundled caps, item-bundled caps, item-bundled primitives, and runtime state) into the **right number** on the character sheet, with **the right tag** attached, gated by the **right condition**, honoring the **right stacking rule** and **mirror direction** — and surface the full provenance chain in every modal.

---

## Why it's harder than "translate to numbers"

You said it best:

> *"all it has to do is translate the modifiers into numbers on the character sheet. But in reality it's way more complicated. Some literally add numbers. Some change numbers. Some just add some tags."*

The modifier system is rich. There are 9 operations, 5 value types, 6 stacking modes, 4 condition shapes, 23 canonical targets plus a `behavior:` escape hatch, an arithmetic equation system with paren groups and tag-style keyword operands, runtime references for values that don't exist at authoring time, a mirror vector system with 4 vectors, and the ability for a modifier to carry a custom behavior variable (e.g. `blockValue = 6`) that other modifiers reference.

Today the character sheet's v1 roll-up uses **`buCost` as a proxy for hardModifiers** everywhere. That's the bug. A primitive with hardModifiers that explicitly say "+2 to vitality, +1 to physical, +1d4 fire damage on action.roll" all collapse to a single buCost number when the sheet rolls up. We need to actually walk the hardModifiers.

---

## What we already have (working today)

These are already authored, tested, and consistent across the schema, the form, the DB, and the engine layer. **Do not re-author.**

| Surface | Where | Status |
|---|---|---|
| `HardModifier` shape (target / op / value / condition / stacking / metadata) | `src/types/swordweave.ts` | ✅ Locked |
| `Phase75HardModifier` shape (token-based value) | `src/types/modifier.ts` | ✅ Locked |
| 9 ops (`add`, `subtract`, `multiply`, `divide`, `set`, `min`, `max`, `grant`, `revoke`) | `src/types/modifier.ts` | ✅ Locked + tested |
| 5 value types (`number`, `text`, `dice`, `boolean`, `equation`) | `src/types/modifier.ts` | ✅ Locked + tested |
| `OP_VALUE_TYPE_MATRIX` (which ops allow which value types) | `src/types/modifier.ts` | ✅ Locked + tested |
| `OP_SPECS` (chirality + mirror behavior per op) | `src/types/modifier.ts` | ✅ Locked + tested |
| `applyMirror(op, value)` (pure mirror function) | `src/types/modifier.ts` | ✅ Locked + tested |
| 3 attributes (`physical`, `mental`, `magic-abstract`) | `src/types/modifier.ts` | ✅ Locked |
| 10 practices (`awareness`, `fieldcraft`, `influence`, `reason`, `vitality`, `lore`, `magic`, `combat`, `movement`, `social`) | `src/types/modifier.ts` | ✅ Locked (TBD against canon names) |
| 3 derived (`pb`, `pb_half`, `level`) | `src/types/modifier.ts` | ✅ Locked |
| `ValueToken` discriminated union (8 kinds incl. `runtime` for unresolved refs) | `src/types/modifier.ts` | ✅ Locked |
| `Operand` / `Operator` / `renderEquation()` for arithmetic expressions | `src/types/modifier.ts` | ✅ Locked |
| `Keyword` operands (tag-style `[fire]` carried through, not arithmetic) | `src/types/modifier.ts` | ✅ Locked |
| `Paren` operands (nested expression groups) | `src/types/modifier.ts` | ✅ Locked |
| `ModifierCondition` v1 (4 shapes: `preset` / `narrative` / `tags` / `compound`) | `src/types/condition.ts` | ✅ Locked |
| 16 canonical `ConditionPresetKey` catalog (target/scene/actor × N) | `src/types/condition.ts` | ✅ Locked |
| `BehaviorTarget = `behavior:${string}`` (free-form runtime variable axis) | `src/types/modifier.ts` | ✅ Locked |
| `ModifierStackingMode` (6 modes) | `src/types/swordweave.ts` | ✅ Locked |
| `ModifierTarget` (23 canonical axes) | `src/types/swordweave.ts` | ✅ Locked |
| `resolveModifiers(input, sourceNames)` engine | `src/lib/engine/resolve-modifiers.ts` | ✅ Implemented + tested in isolation |
| `resolveMirrorEffect(vector, isMirrored, value)` engine | `src/lib/engine/mirror.ts` | ✅ Implemented + tested |
| `resolveAttributeModifier(input, attr)` engine | `src/lib/engine/target-registry.ts` | ✅ Implemented |
| `resolveAllDefensiveDCs(input)` engine | `src/lib/engine/target-registry.ts` | ✅ Implemented |
| `computeVitalityModifiersFromPrimitives()` engine | `src/lib/engine/vitality.ts` | ✅ Implemented |
| `evaluateCondition()` for legacy `{key, operator, value}` triples | `src/lib/primitives/condition` | ✅ Implemented (legacy only) |
| `applyOperation()` (single-op arithmetic) | `src/lib/engine/operations` | ✅ Implemented + tested |
| `applyStacking()` (combine contributions per stacking mode) | `src/lib/engine/stacking` | ✅ Implemented + tested |
| `migrateOperation("toggle"/"bias") → "set"/"grant"` | `src/types/modifier.ts` | ✅ Implemented + tested |
| `parseValueField()` (auto-coerce raw values into ValueToken[]) | `src/types/modifier.ts` | ✅ Implemented + tested |
| `bulkResolveLatestVersions()` | `src/lib/versions/bulk-resolve-latest-versions.ts` | ✅ Implemented + tested |
| Bundle expansion (heritage → caps → prims + effects → mirror ceiling) | `src/lib/api/enrich-item-links.ts`, `src/lib/api/character-bundle-saver.ts` | ✅ Implemented |
| Version/provenance chips (rounds 7–13 of Session H) | `src/components/characters/slot-source-badge.tsx` | ✅ Implemented |

---

## What's broken or missing (the Session I scope)

| # | Item | Severity | Symptom |
|---|---|---|---|
| I1 | **Null sub-target bug** — modifier with `target: "character.attribute.physical"` axis but no sub-target selected → adds to all attributes instead of none | 🛑 Root bug, cascades into I2–I5 | Sheet shows wrong attribute bonuses |
| I2 | **Character sheet rolls up via `buCost`, not via hardModifiers** | 🛑 All modifier math is wrong | Sheet shows `+5 mental` because the primitive's `buCost = 5`, not because any modifier actually says so |
| I3 | **Conditions are display-only** — v1 condition shapes (`preset` / `narrative` / `tags` / `compound`) never gate the modifier at runtime | 🛑 Wrong numbers when conditions should suppress | Sheet shows `+3 to grappled bonus` even when target isn't grappled |
| I4 | **Stacking defaults to `stack`**, not `highest-only` as intended | 🛑 Wrong totals | A modifier slotted twice contributes 2× instead of the safer 1× |
| I5 | **Custom behavior variables** (e.g. `blockValue = 6`) — no system to persist / resolve them across primitives | 🟡 New surface | Author-defined runtime variables don't flow between modifiers |
| I6 | **Tag operands** (`[fire]` inside equations) — resolver carries them through but the sheet doesn't surface them | 🟡 Missing label | Damage rolls don't show the damage type chip |
| I7 | **Advantage/Disadvantage glyph system** (`︽` / `︾` per your spec, with `*` for conditional) | 🟡 New UI | Sheet shows nothing for advantages; should show glyphs next to the affected axis |
| I8 | **"Small cards" zone in bottom drawer** for movement speeds, resistances, vulnerabilities, languages, advantages, custom behaviors | 🟡 New UI | These tags currently have no home on the sheet |
| I9 | **Modal traceability is incomplete** — modals don't show the full primitive → capability → effect → item chain or the substituted formula | 🟡 Quality of life | Hard to debug "where does this number come from" |
| I10 | **Mirror COST_INSTABILITY user-side cost** (extra_strain) — resolver captures it, no place on the sheet for it | 🟡 Missing display | -5 vitality from mirror shows nowhere |
| I11 | **DB seed quality** — most primitives have template/incomplete modifiers; `target = "attribute"` with no sub-target is common | 🟡 Data quality | Even after engine fixes, sheet may show empty for many slots |
| I12 | **`buCost` should NOT be a fallback for modifiers** (per your feedback) | 🛑 Design principle | Delete the buCost-as-fallback path entirely |
| I13 | **Items drive modifiers** — primitives nested in items contribute to the sheet | ✅ Already works via bundle expansion | Confirm |
| I14 | **Capabilities are activatable / triggerable** — sheet at rest shows passive baseline; trigger caps fire and log to history | 🟡 New model | Sheet doesn't differentiate between active/passive/trigger caps |
| I15 | **Movement sub-types** (climb, fly, swim, burrow) — sheet only shows land | 🟡 Missing axes | Sheet doesn't surface climbing speed, flight, etc. |
| I16 | **Per-action modifiers** — `action.roll` is one target; some modifiers should target specific action types | 🟡 Schema question | Schema doesn't have sub-targets under `action.*` |

---

## What we clarified (your feedback round 1, 2026-08-04)

These are settled. Answered inline.

### The null sub-target bug
> *"Attribute increment with target attribute with no attribute selected should not give any modifier to anything for example even if set up. We have to explicitly set a target/sub target (like what changes? Attribute, mental, not just attribute and leave toggles empty)."*

**Decision:** A modifier with axis set but sub-target empty → does NOT contribute to anything. The author must explicitly fill in the sub-target. This applies to all axes that have sub-targets (`attribute`, `defense`, `vitality`, `movement`, `action.*` if we add sub-targets).

### Advantage/Disadvantage glyphs
> *"on character sheet if advantage near the practice for example, we should set `︽` (U+FE3D) and for disadvantage `︾` (U+FE3E). But what about advantage on fieldcraft based on tracking? I guess `︽ *` (and we write 'based on tracking enemies' in the modal)."*

**Decision:** Glyphs `︽` / `︾` for advantage/disadvantage. Asterisk `*` appended when the modifier has a condition (so DM clicks the modal to see "based on tracking enemies"). Glyphs go near the affected axis on the sheet.

### Custom behavior variables
> *"I will create a primitive with a modifier target behavior called (key) blockValue (or block) set to 6. And a capability called Blocking with some primitives that while capability active it will subtract blockValue from damage taken. This is just one example, possibilities should be endless."*

**Decision:** `behavior:<name>` is a fully open runtime variable space. Authors can name any variable. The engine resolves `behavior:<name>` references by walking the slotted modifiers and finding the latest `set` to that name (or `add` / `multiply` etc.). The variable's value lives only as long as the modifiers that set it.

### `buCost` is NOT a proxy
> *"buCost should be no proxy for modifiers. It has nothing to do with them."*

**Decision:** Delete the buCost-as-proxy path entirely. The engine walks hardModifiers only. If a primitive has empty hardModifiers, it contributes nothing. (DB cleanup is a separate sub-task — I11.)

### Capability activation state
> *"there are capabilities that can be triggered or set active/inactive. like a capability will deal 2d6 fire damage (albeit via a primitive inside it), but not the primitive itself."*

**Decision:** Capabilities have an activation state. The sheet at rest shows the *passive baseline*. Trigger caps are normally inert; firing them logs to history AND adds their contribution to the active total for that moment. Augment caps apply their modifier (e.g. `+PB to attacks`) when the augmented action is taken.

### Items drive modifiers
> *"the primitives from items can also affect the sheet. Like I can get +1 attack roll from item."*

**Decision:** Items contain primitives → primitives carry modifiers → modifiers target `action.roll` (or whatever). Already works via bundle expansion. Confirm at end of phase.

### Runtime UX — two surfaces
> *"1. In capabilities we already have the description of capabilities and primitives. We click on one, modal opens with all the info we need. 2. In the bottom drawer (modals that open on click for everything) where we have the actual numbers and the traceability for each thing for quick access."*

**Decision:** Two surfaces for tag-bearing modifiers:
- **Modal on click** in capabilities/items tab → describes the modifier and its condition
- **Bottom drawer** → shows the running totals + glyphs + a new "small cards" zone for non-numeric tags (advantages, resistances, movement speeds, custom behaviors)

### Modal traceability
> *"we need the full traceability. Like we have in drawer +10 Fieldcraft. In its modal we have general formula, we have the provenance of what contributes to it (modifiers, proficiency bonus, primitives that contribute, and tidal) and below we have the formula again with everything substituted it."*

**Decision:** Every modal in the bottom drawer must show:
1. **General formula** — e.g. `final = slice + PB + sum(primitive contributions)`
2. **Provenance breakdown** — list of contributors with their source (heritage → cap → effect → primitive → modifier chain)
3. **Substituted formula** — same formula with every token replaced by its resolved value

(TBD — see J1 question below re: the word "tidal".)

### DB seed quality
> *"some primitives are not good at all when it comes to modifiers. Also, most of those with modifiers (like attribute increment) are just templates, incomplete."*

**Decision:** DB seed cleanup is part of Session I. After the engine is wired, audit the primitives and fill in the missing modifier specs.

### Stacking default
> *"It is stacking by default, but can be changed. […] But highest-only as default should be safer."*

**Decision:** Engine default for missing `stacking` field is `highest-only`. DB should still record explicit `stacking` per modifier (UI enforces this), but the runtime fallback is `highest-only`.

### Mirror COST_INSTABILITY / user-side cost
> *"A primitive can be mirrored to get some penalties in order to access more primitives. I can get vitality mirror (-5 vitality, appears in modal for vitality), or a mirror to give me vulnerability to fire, in the new section with small cards."*

**Decision:** Mirrored primitives can impose **user-side penalties** (negative vitality, vulnerability, debuffs). These appear:
- In the modal for the affected axis (e.g. -5 vitality in the Vitality modal)
- In the new "small cards" zone (e.g. vulnerability:fire)
- Never DM-only — always visible to the player

### Sheet shape — numbers AND breakdown
> *"in the drawer and stuff the final number and in the modal on click we have the breakdown and traceability. […] we also need a full traceability. Like we have in drawer +10 Fieldcraft. In its modal we have general formula, we have the provenance of what contributes to it (modifiers, proficiency bonus, primitives that contribute) and below we have the formula again with everything substituted it."*

**Decision:** Sheet shows the **final number** per axis in the drawer (compact). Modal on click shows the **full breakdown** with provenance chain + substituted formula.

### Character sheet = expected outcome
> *"The character sheet is the expected outcome. How we have it now. (We are still missing things maybe like movement speed and specialized movement speed like climbing flying burrowing swimming)."*

**Decision:** The current character sheet (top section + bottom drawer) is the target layout. Phase 8.I adds:
- Movement sub-types (climb/fly/swim/burrow)
- The "small cards" zone for non-numeric tags
- Glyphs (`︽` / `︾`) next to affected axes
- Full modal traceability for every number

---

## Open questions (asked 2026-08-04, awaiting your answers)

These are the gaps where the design is not yet specific enough to write code. Group by area.

### A. Null sub-target behavior

- **A1.** When modifier schema target is `<axis>` (e.g. `attribute`) but no sub-target (e.g. `physical`/`mental`/`magical`) selected:
  - (a) silently dropped (no number, no chip, no audit row)
  - (b) silently dropped at engine level BUT surfaced as "non-contributing modifier" in the modal/audit
  - (c) raises validation error at save time so author must fix before publishing
- **A2.** Same question for `target = "character.skill"` and `target = "action.roll"` — these don't have sub-targets. Are they always valid? Or is there a "skill name" / "action name" that ALSO must be filled in, and if blank, same drop rule?
- **A3.** For `behavior:blockValue` style targets — those are free-form strings. If the author writes `behavior:` with nothing after it, same drop rule?

### B. Advantage / Disadvantage glyph system

- **B1.** The `*` means "has a condition attached". Confirm? Or is `*` the literal symbol and the condition is a separate annotated footnote chip in the modal?
- **B2.** When a modifier grants `advantage` AND has a condition AND is slotted as heritage-bundled vs direct — does the sheet show the same `︽ *`?
- **B3.** When a modifier grants advantage WITH a condition (e.g. "only when target is below half HP"):
  - (a) `︽ *` always (indicating "if condition met, you'd have advantage here")
  - (b) `︽ *` only when the condition is currently MET in the scene
  - (c) nothing at all when condition isn't met, `︽` (no asterisk) when it IS met
- **B4.** Stacking rules for advantage/disadvantage — when TWO modifiers grant advantage on the same practice:
  - (a) double up (2× advantage — usually meaningless in D&D-style, but SwordWeave may differ)
  - (b) just count as one `︽` (anything > 1 advantage = 1 advantage)
  - (c) depend on the modifier's stacking mode
- **B5.** Legacy `{key, operator, value}` rows in DB — some are probably old `bias-value` rows that grant advantage/disadvantage. Do those parse cleanly into `grant`/`revoke` on `behavior:advantage` / `behavior:disadvantage`? Or do we need a DB backfill as part of Session I?

### C. Custom behavior variables (blockValue)

- **C1.** The capability has a primitive that **subtracts** `blockValue` from damage. That primitive's `value` is the token `behavior:blockValue` (read-only, resolved at runtime). The capability is only "active" when the Blocking stance is on, so the modifier is gated by capability.active=true. Confirm?
- **C2.** When the capability is inactive, does the modifier:
  - (a) not contribute at all (gated by capability.active=true)
  - (b) still contribute but marked as `*` (gated) on the sheet
  - (c) still contribute at half strength or reduced form
- **C3.** Order of evaluation: if a primitive SETS `behavior:blockValue = 6` and another primitive SUBTRACTS `blockValue` from incoming damage — do we resolve `blockValue` first (state-like), or is the order sequential within a single capability's modifier chain?
- **C4.** Custom variables that the author names — engine should:
  - (a) auto-create a state slot the first time a `set` modifier targets `behavior:<name>` (default 0)
  - (b) require author to declare the variable in a separate "runtime variables" schema/UI first
  - (c) attempt to read whatever `behavior:<name>` value exists; if never been set, modifier resolves to 0 silently
- **C5.** When the sheet shows `blockValue = 6`, where does it live? In the new "small cards" zone? Or hidden behavior that only surfaces when something references it?
- **C6.** Can a single capability have multiple primitives that all target `behavior:blockValue`? Canonical order: `set → add → multiply → divide → min/max → grant/revoke`?

### D. Capabilities are activatable / triggerable

- **D1.** Sheet at rest shows:
  - (a) ALL slotted caps (active + passive + trigger + augment + reaction) summed up, ignoring activation state except for trigger caps
  - (b) only PASSIVE caps by default, with an "Active loadout" view to toggle trigger caps on/off
  - (c) sheet shows passive as baseline; modal of each cap shows "what this contributes when active"
- **D2.** When a trigger is fired (logged in history), does the history row include the **provenance chain**? E.g. "Triggered Aegis Shield → 2d6 + PB + (Ironborn heritage → Heavy Steps → +1 physical) = 18 damage blocked"?
- **D3.** Mirror on a capability — primitives INDIVIDUALLY mirrored (each flips its own op), or whole capability's contribution flips uniformly?

### E. Items drive modifiers

- **E1.** Bundle expansion already walks into items. Confirm: an item's `capabilityLink` chain shows provenance as `Item → Capability → Effect → Primitive → Modifier` in the modal. Same convention as heritage-bundled caps. OK?
- **E2.** When an item has both a direct-equipped modifier (via a primitive slotted inside the item) AND a slot-cost modifier — both contribute independently, OR equipping the item gates the modifier (only when equipped)?

### F. The "small cards" zone in the bottom drawer

- **F1.** Taxonomy — should it be:
  - (a) one big "Bag" zone with all behavior tokens collected, grouped by category (`movement`, `damage-type`, `meta`, `custom`)
  - (b) dedicated zones per category (one row for movement, one row for damage modifiers, one row for meta tags)
  - (c) one zone per `behavior:` target namespace
- **F2.** New things to appear as small cards (not just behaviors) — explicit list needed. Suggestion:
  - resistance:fire, resistance:cold, immunity:poison, vulnerability:radiant
  - advantage:fieldcraft (conditional → `︽ *`), advantage:attack
  - movement:-+10ft, movement:fly 30ft, movement:swim 15ft, movement:climb 15ft, movement:burrow 5ft
  - darkvision:60ft, blindsight:30ft, tremorsense:any
  - languages:Common, languages:Draconic, languages:Thieves' Cant
  - custom:blockValue:6, custom:manapool:30, custom:spellslots:1/day
- **F3.** When a behavior card has a numeric value (e.g. `movement: 35ft`), should it be **editable** on the sheet (DM tracks current vs base), or always computed (read-only)?
- **F4.** When a behavior card has a condition attached, the card shows the `*` indicator AND the modal shows the condition. Do all small cards support conditions, or only some?

### G. Modal traceability

- **G1.** "And tidal" — what does that mean? I don't see this in the modifier system. Is it a typo for "title" / "detail" / "tied" / "trial" / something else? Or is there a `tidal` modifier concept I'm missing?
- **G2.** Provenance chain — flat list (one row per contributing primitive) or tree (capability → effect → primitive → modifier, recursively)?
- **G3.** Substituted formula — each contributor shows its own source + condition + stacking rule, OR per-contributor collapsed into one row with "click for full detail"?
- **G4.** For mirrored contributors, show both pre-mirror and post-mirror values (e.g. `+2 (mirrored to -2)`)? Color hint (red for negative, teal for positive)?

### H. DB seed quality

- **H1.** When Session I is done, do we want to:
  - (a) ALSO do a DB cleanup pass now — author proper modifiers for seed primitives so Tessy's sheet has real numbers
  - (b) DEFER DB cleanup to a later session
  - (c) MIX — wire engine correct against any modifier shape, AND fix the most-used primitives as a quick win. Defer the rest
- **H2.** Primitives with `target: "attribute"` but no sub-target selected — should we flag them in DB (a `needs_review` flag, or a separate column) so the data-quality view shows "these primitives have malformed modifiers"?
- **H3.** Custom behavior variables like `blockValue` — persist in a `runtime_variables` table with `(character_id, name, value)` tuples, OR transient (lived only in modifier resolution, never stored, just computed on the fly)?

### I. Stacking default

- **I1.** Confirm: missing `stacking` field in DB → engine defaults to `highest-only` (not `stack`). DB should still record explicit stacking per modifier (UI enforces this), but runtime fallback is `highest-only`.
- **I2.** For `set` operations specifically — does `stack` even make sense? `set` overrides. If three modifiers `set` attribute to 5, 10, 15, result is 15 (last-write-wins). Is `set` always last-write-wins, OR does it follow the modifier's stacking mode?

### J. Engine vs display-only

- **J1.** Conditions on a modifier — when **active** (condition met), engine adds its contribution. When **inactive**, engine ignores it. Sheet chip for the modifier shows `*` to indicate "conditional, check modal." Confirm?
- **J2.** Base attributes (slice values set in Identity tab) — modified by primitive modifiers at engine level, OR used as base for the formula with primitives on top? In other words: `displayed_attribute = slice + sum(primitive modifier contributions)`. Yes?
- **J3.** Modifier targets `attribute` axis but sub-target is `physical` — engine adds to `physical` only. Slice for physical is shown as `physical: slice + sum(modifiers)`. Same for mental and magical. Each independent. Confirmed?
- **J4.** Modifier targets `action.roll` or `action.damage` — contribution added to a generic `action` total, OR each `action` modifier knows which specific action it rolls for? Schema has `action.roll` as single target — does that mean all actions roll the same modifier, OR is `action.X` a wildcard needing sub-targeting?
- **J5.** Slot NOT mirrored but modifier's `metadata.mirror.optedOut = true` — no-op (pass-through unchanged), OR inert (no contribution)?

### K. Where to start

- **K1.** Highest priority to land first?
  - (a) Engine resolution — wire `resolveModifiers()` into character sheet (replace buCost-as-proxy). Smallest scope, biggest correctness win.
  - (b) Null-target bug fix — fix "no sub-target = adds to all" bug. Very narrow, unblocks the audit.
  - (c) Custom behavior variables — design and wire `blockValue` system. New surface, biggest design decision.
  - (d) The "small cards" UI — bottom drawer zone for tags, resistances, etc. Visible win, no engine changes.
  - (e) DB seed cleanup — make existing primitives have proper modifiers. Data work, not engine work.
- **K2.** Anything I should NOT touch in Session I? E.g. "don't rewrite the existing practice formula" or "don't change the slot-receiver tab"?

---

## What happens after you answer

1. I'll fold the answers into this doc (replace the open-questions section with "Decisions log").
2. I'll write a concrete subtask breakdown for I1–I11 (in execution order, dependency-aware).
3. We'll start with the highest-priority item per your K1 answer.
4. Each subtask gets its own commit per your preference (4 sequential commits over 1 signoff-gated commit).

---

## Notes for future reference

- The DB stores modifiers as `hard_modifiers JSONB` on each primitive row. The shape is the legacy `HardModifier` (`value: JsonValue`). The Phase 7.5 shape (`Phase75HardModifier` with `tokens: ValueToken[]`) is the target. There's an in-flight migration window where both shapes parse via `parseValueField()`.
- The resolver today does NOT walk v1 condition shapes (`preset` / `narrative` / `tags` / `compound`). It treats `null` condition as active and treats any condition with a `kind` discriminator as active. Only the legacy `{key, operator, value}` path is actually evaluated. **I3 fix.**
- The `conditionActive` field in `ModifierContribution` is currently `!mod.condition || "kind" in (mod.condition ?? {})` — a soft-warn placeholder. I3 replaces this with real evaluation.
- The runtime reference token (`{kind: "runtime", name: "blockValue", hint: "number"}`) is the parser's fallback when the author types a non-canonical inner string. The resolver soft-warns at character-sheet render time if the runtime reference is still unresolved — no hard error, it's an open future slot.
