# Primitive Target Ontology — Phase 8.I i2.7

**Author:** Senku (with Mashu input — 2026-08-06)
**Scope:** Primitives only (capabilities and effects are NOT touched here)
**Goal:** Lock the vocabulary of targetable atoms before spreading
inconsistencies across the value / trigger / operation pickers.

---

## What "everything is one suggestion surface" means

For the primitive build modal, the author can:

| Field | What they pick |
|---|---|
| **Target** | "What does this modifier affect?" — e.g. `skill_practice_check`, `vitality`, `equip_slot` |
| **Sub-target** | "What specific scope within that target?" — e.g. `prowess` for `skill_practice_check`, `block_value` for `behavior`, **or a custom `{key}` for the new targets** |
| **Operation** | `add`/`set`/`grant`/`revoke`/`multiply`/etc. |
| **Value** | A chip stack with the **same atoms** as conditions |
| **Triggers when** | The **same atoms** as value — pills with operator + value |

All 5 fields reference the **same set of atoms** (vitality, attributes,
practices, custom vars, equip_slots, speed, etc.). The atom's *form*
changes by context (chip in value, pill in trigger) but the *name* is
canonical.

---

## The atoms (canonical targets)

### Already exist (i2.6 baseline)

| Target | Kind | Sub-target | Example modifier |
|---|---|---|---|
| `skill_practice_check` | numeric (modifier on roll) | fixed enum (10 practices) | `+PB` when proficient |
| `attribute` | numeric | fixed enum (3 attrs) | `+2 to physical` |
| `action.<verb>` | numeric (damage/heal) | none | `+1d8 fire damage` |
| `vitality` | numeric (heal/damage) | none | `+10 vitality on hit` |
| `vitality_max` | numeric | none | `+5 max vitality` |
| `save_dc` | numeric | none | `+1 to save DC` |
| `defense_dc` | numeric | none | `+1 to defense DC` |
| `behavior:<key>` | mixed | **custom `{key}`** | `set block_value to 6` |
| `reaction` | boolean | none | `+1 reaction slot` |
| `bu_budget` | numeric | none | `+5 BU` |
| `action_type` | tag | none | (deprecated by action.<verb>) |

### NEW in i2.7 (this pass)

| Target | Kind | Sub-target | Source | Example |
|---|---|---|---|---|
| `combat_action` | boolean/stateful | none | Combat Rhythm PDF | "this applies when the character declares a main intent" |
| `speed` | numeric | none | Combat Rhythm / Encumbrance | `+10 speed` |
| `size` | tag enum (Tiny..Gargantuan) | none | Encumbrance | `+1 size tier` (Enlarge spell) |
| `carry_capacity` | numeric | none | Encumbrance | `×2 carry capacity` |
| `equip_slot` | mixed (slot-N or named) | **custom `{key}`** (slot-N or named) | Encumbrance | `set equip_slot:weapon to long_sword` |
| `load` | numeric | none | Encumbrance | `+1 load (heavy armor)` |
| `damage_type` | tag enum | **custom `{key}`** | Damage & Resistance | `add damage_type:fire` to capability |
| `source_type` | tag enum (physical/magical/psychic) | none | Damage & Resistance | `add source_type:magical` |
| `upkeep_cost` | numeric | **custom `{key}`** (capability instance) | Upkeep | `+5 upkeep_cost for capability:fire_shield` |
| `maintained_capability` | boolean | **custom `{key}`** | Upkeep | `+1 maintained_capability:fire_shield` |
| `strain` | numeric (0-6) | none | Player Loop | `+1 strain per round` |
| `complexity` | numeric (0-4+) | none | Player Loop / Combat Rhythm | `+1 to complexity cap` |

### Deferred (NOT in this pass)

| Target | Why deferred |
|---|---|
| `cover_state` (total/half/none) | Requires player FAB to toggle (Phase 2) |
| `vitality_collapse_clock` | Requires player FAB |
| `attribute_save` | Defense DC math is being rewired — separate phase |
| `practice_save` | Same |

---

## The "everything is one suggestion surface" — concrete chip / pill names

For each new target, here are the canonical chip names that appear in
**value** (as chip), **trigger** (as pill), and **operation** (as tag):

| Atom | Value chip | Trigger pill |
|---|---|---|
| speed | `+ speed` | `actor:speed < N` |
| size | `+1 size` | `actor:size == Large` |
| carry_capacity | `+ carry_capacity` | `actor:carry_capacity > 50` |
| equip_slot | `+ equip_slot:N` | `actor:equip_slot:weapon == long_sword` |
| load | `+ load` | `actor:load > 10` |
| damage_type | `+ damage_type:fire` | `actor:damage_type == fire` |
| source_type | `+ source_type:magical` | `actor:source_type == magical` |
| upkeep_cost | `+ upkeep_cost` | `actor:upkeep_cost < 5` |
| maintained_capability | `+ maintained:fire_shield` | `actor:maintained:fire_shield` |
| strain | `+ strain` | `actor:strain > 2` |
| complexity | `+ complexity` | `actor:complexity >= 4` |
| combat_action | (boolean — used as trigger only) | `actor:in_combat` |

---

## Operation × target matrix

Most operations are valid for any target. But there are restrictions
worth noting:

| Operation | Valid on | Notes |
|---|---|---|
| `add` | numeric targets | standard |
| `set` | numeric, slot, boolean, tag | standard |
| `multiply` | numeric targets | `%`, `×N` |
| `divide` | numeric targets | mirror of multiply |
| `grant` | boolean, tag | standard |
| `revoke` | boolean, tag | mirror of grant |
| `min` / `max` | numeric | standard |
| `roll_dice` | numeric (damage) | standard |

`set` on a `equip_slot:{key}` is the canonical "equip this item here"
operation. `set` on `size` is "change size to this value".

---

## Sub-target `{key}` pattern (author-named runtime refs)

For targets that don't have a fixed enum, the author types a key at
primitive authoring time. The engine resolves at apply time.

| Target | `{key}` shape | Example |
|---|---|---|
| `behavior:<key>` | already exists | `behavior:block_value` |
| `equip_slot:<key>` | slot index (0-5) or named slot | `equip_slot:0`, `equip_slot:weapon` |
| `damage_type:<key>` | damage type name | `damage_type:fire` |
| `upkeep_cost:<key>` | capability identifier | `upkeep_cost:fire_shield` |
| `maintained_capability:<key>` | capability identifier | `maintained:fire_shield` |

Sub-targets are typed in the same `{key}` textbox pattern as
`behavior other` and `scene pace`.

---

## `lexicon` — never landed as a DB column

Verified 2026-08-06: there is no `lexicon` column in the `primitives`
table. The phase-7.5 spec listed it as a planned "Identity" field but
it never actually shipped as a real column. References to `lexicon`
in code are dead comments only.

So the migration map (combat → combat_action, movement → speed)
becomes: when an author TODAY writes a primitive that semantically
maps to one of these categories, they pick the new target name
directly. No DB migration needed — the new targets just appear in the
dropdown.

---

## Out of scope (deferred to later phases)

1. **Engine math** for new targets (the targets exist as suggestions;
   engine doesn't yet sum them when computing the character sheet)
2. **Item form**: equip_slot + load fields (separate feature)
3. **Capability form / effect form** (per Mashu 2026-08-06: "don't touch")
4. **Player FAB** for stateful targets (cover, vitality_collapse_clock,
   etc.)
5. **Mirror on new targets**: per Mashu 2026-08-06, mirror is just
   `mirrorable: true` per primitive; the inverse is derived from the
   operation. No target-specific mirror logic needed.

---

## Test strategy

1. **Unit tests** for the target registry (add new entries; verify they
   appear in the picker)
2. **Unit tests** for the sub-target `{key}` resolver
3. **Unit tests** for the cross-field suggestion surface (each atom
   appears in value + trigger)
4. **Integration test** — open a primitive, add `+speed` modifier,
   save, reload, verify the chip is still there

No engine math changes this pass; engine behavior is unchanged.