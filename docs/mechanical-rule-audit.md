# Mechanical rule shape audit — 28 September 2026

The audit was read-only. After reviewing the complete before/after plan, the narrow Fire resistance repair was applied as version 4; no other catalog entries or characters were modified. The initial targeted name audit was expanded to every saved `grant` modifier targeting `damage_type` or `damage_modifier`. This is a focused shape audit, not a claim that the entire catalog has valid semantics.

## Findings

| Primitive | Evidence and impact | Disposition |
|---|---|---|
| **13643 — Fire Damage resistance** | `damage_type / grant / keyword(resistance)` with explicit `scopeName: fire`. Current text is “Grant resistance to Damage Type.” User-owned despite `sourceOrigin: system`; 1 BU; versions 1–3. No direct character, heritage, capability, effect, condition, item, entity, or adoption links; no publication. Only matching damage-grant candidate found. | Unambiguous mechanical normalization: `damage_modifier / multiply / {kind:number,value:0.5}`, preserving fire scope, metadata, stacking and price. Authoring family becomes `DAMAGE_MULTIPLIER`; text “Take half fire damage.” Applied as version 4, preserving versions 1–3; a second run confirmed no further changes. |
| **221 — Aero Unlock** | `behavior:fly_speed / grant / 1`, but fork hint says fly speed equals baseline land speed; no hover/constant forward movement. System; 15 BU; versions 1–3. One heritage link explicitly says “Fly speed = land.” | Do not invent a fixed numeric speed. Engine compatibility now recognizes this access token. It does not yet connect the permission to walking speed; the existing narrative restriction remains, and the dynamic speed needs an explicit rule rather than a guessed distance. No database rewrite proposed. |
| **387 — Structural Hardening (Domain Resistance)** | Unbound system seed; 8 BU; versions 1–3. Five heritage links refer to Cold, Fire, Pressure, Weather, and an unspecified resistance. Also one direct character slot pinned to v1, one effect, one item. | **Cannot assign one scope globally.** A later authoring repair must create or select a bound expression for each intended use and explicitly adopt it. Preserve the unbound seed and existing pins. |
| **160–165 — Positive/Negative Bias templates** | Explicit seed instructions require narrative focus, named practice or core attribute. No binding supplied in the shared seed. Some negative seeds are linked into effects/capabilities. | Do not invent a target or grant global advantage/disadvantage. Bind in the authoring flow; retain the original template. |
| **11329 — Negative Bias II — Awareness (fork)** | Explicit typed disadvantage on `skill_practice_check`, PRACTICE/AWARENESS scope. User-owned fork of163; versions1–6; two character links. | Already scoped. Leave intact. |
| **14101 — Legendary Resistance** | Legacy modifier lacks `kind`, uses dotted `behavior.legendary_resistance`, and `grant1`. User-owned; 1BU; versions1–2. One character slot has `slotSource: PINNED` but **null `versionId`**. | Compatibility normalization must accept its legacy shape without turning an access count into an attribute score. Null version is a live-row fallback, not an immutable historical pin. No price or reset-frequency inference. |
| **397/398 — Legendary Resistance system templates** | Access counters1/3, explicit fork hints.398 mixes “3x/day” with “per encounter.” | Do not silently resolve the reset-frequency conflict. Author review needed. |

## Repair procedure

`scripts/repair-mechanical-grants.ts` allows only primitive13643 with its reviewed ID, name, exact authoring rule, unconditional/self modifier shape, resistance keyword and empty target scope. It refuses broader name matching or ambiguous cases.

Default invocation is read-only:

```sh
pnpm exec tsx scripts/repair-mechanical-grants.ts
```

It writes a private (`0600`), exclusive-create JSON file under ignored `.migration-backup/`, containing the **full original row, every primitive version, all primitive junctions/adoptions, publications and fork records**, plus the exact proposed fields. It does not write to the database.

After an explicit decision to apply, the tool requires both the reviewed plan and allowlisted ID:

```sh
pnpm exec tsx scripts/repair-mechanical-grants.ts --apply --approved-id=13643 --plan=.migration-backup/<reviewed-plan>.json
```

Apply locks the primitive row, compares the current complete capture against the reviewed before-state, and aborts if content, versions or relationships changed. Only mechanical rule/modifier/text, content hash and update time change. It uses the normal canonical payload/hash and `recordVersion` service inside `withDatabaseTransaction`. It retains ID, ownership, source lineage, visibility, narrative, price, mirror metadata and iconography. It creates a new content-addressed snapshot, leaving historical snapshots, junctions, publication references, adoptions and pins intact. Reapplying an already-matching repair is a no-op.

Because there are currently no linked slots for13643, no existing character needs repinning. In the general case, fixing a live catalog row alone must **not** move a character's historical version pin; that remains an explicit adoption decision. This script is deliberately not a bulk repinning tool.

The full read-only investigation is stored locally in `tmp/rule-shape-provenance.json`; the initial inputs are `tmp/rule-shape-audit.json` and `tmp/audit-rule-shapes.ts`. These local snapshots contain ownership and relationship data and should not be committed.
