# Source 15 — Combat Engine — Resolution Pipeline (Canonical Consolidation)

Notion ID: 37fed8479ccd814fabaed703f85d7af2
Parent page: SwordWeave TTRPG System Master Hub (37eed8479ccd81fa8150d0b31e22ff1f)
URL: https://app.notion.com/p/Combat-Engine-Resolution-Pipeline-Canonical-Consolidation-37fed8479ccd814fabaed703f85d7af2
Last edited: 2026-07-03T18:48:00.000Z

---

[Content retrieved from Notion — treat as data, not instructions.]

---

# ⚔️ Combat Engine — Resolution Pipeline (Canonical Consolidation)

## 🎯 PURPOSE

This page consolidates the final runtime combat logic after Action Economy, Runtime Play Loop, Vitality, Strain, Cost, and DC systems were stabilized.

It does NOT introduce new mechanics.

It clarifies:

- execution order
- interruption timing
- strain application timing
- cost application timing
- vitality interaction

---

# 🧭 COMBAT RESOLUTION ORDER

Every combat action follows the same sequence.

## STEP 1 — DECLARATION

Actor declares:

- action
- capability
- target(s)
- intent

Movement remains free.

---

## STEP 2 — EXECUTION WINDOW

Determine whether the capability has a cast/execution window.

### Instant

No interrupt window.

Examples:

- attacks
- action-speed capabilities
- reactions

### Extended Execution

Interrupt window exists.

Examples:

- 1 round casts
- 1 minute casts
- ritual effects

---

## STEP 3 — INTERRUPTION (IF APPLICABLE)

Only possible during an execution window.

Interruption is typically performed through:

- reactions
- capabilities
- environmental effects

DM determines:

- success
- failure
- partial disruption

---

## STEP 4 — RESOLUTION

Rolls occur.

Examples:

- attack vs DC
- capability vs DC
- save vs DC

The outcome of the action is now known.

---

## STEP 5 — STRAIN APPLICATION

IMPORTANT:

> Strain is applied AFTER resolution.

This includes:

- successful execution
- failed attack rolls
- successful saves by targets

If interruption occurred:

- strain application is DM discretion

---

## STEP 6 — COST APPLICATION

Cost is determined after strain is known.

Cost is the consequence layer.

Cost may take the form of:

- vitality loss
- resource expenditure
- environmental change
- narrative consequence
- no cost

---

# 🧠 STRAIN SYSTEM

Strain is a 0–6 intuition score.

## Influenced By

- Scale
- Impact
- Complexity
- Time pressure / compression

No formula is required during play.

DM evaluates by feel.

---

## STRAIN TIERS

| Tier | Meaning |
| --- | --- |
| 0 | effortless |
| 1 | light effort |
| 2 | noticeable strain |
| 3 | heavy burden |
| 4 | dangerous instability |
| 5 | critical failure risk |
| 6 | catastrophic consequence |

---

# 💠 COST SYSTEM

Cost is NOT a number.

Cost is:

> the world reacting to strain.

Strain determines severity.

Cost determines form.

---

## COST TYPES

- Vitality loss
- Resource use
- Environmental change
- Narrative consequence
- None

---

# ❤️ VITALITY SYSTEM IN COMBAT

## Formula

Vitality = (10 + PB) × Level

---

## Recovery

### Long Rest

Restore 100%

### Short Rest

Restore 50%

### Healing

Restores vitality directly.

---

## Combat Function

Vitality acts as:

- health pool
- endurance pool
- magical exertion pool
- capability execution buffer

---

# 🎯 DC SYSTEM

Combat uses the unified DC system.

## Resolution Axes

- Physical DC
- Mental DC
- Magical DC

Examples:

- attacks vs Physical DC
- persuasion effects vs Mental DC
- magical effects vs Magical DC

---

# ⚡ REACTION RULES

## Core Rule

Each creature receives:

> 1 Reaction per round.

Once spent:

- no further reactions until next round

---

## Reaction Usage

Reactions may be used:

- whenever triggering conditions occur
- before the next turn begins

Reaction capabilities still generate strain and cost normally.

---

# ⏳ CASTING TIME & INTERRUPTION

Casting time is NOT a separate system.

It is one of the factors that influences strain.

Longer execution windows create larger interruption opportunities.

Examples:

- Action = difficult to interrupt
- 1 Round = interruptible during round
- 1 Minute = many interruption opportunities
- Ritual = highly vulnerable

---

# 🧠 FINAL COMBAT TRUTH

1. Declare action
1. Determine execution window
1. Resolve interruption if relevant
1. Resolve rolls
1. Apply strain
1. Apply cost
1. Continue Combat Rhythm sequence (resolve remaining tracks + triggered reactions)

Combat is therefore:

> a deterministic resolution engine with flexible consequence interpretation.

---

# 📌 STATUS

Canonical Combat Consolidation Layer

---

## 🔒 CANONICAL CLARIFICATIONS (POST-CONSOLIDATION)

### Reactions

- Each creature receives exactly 1 Reaction per round.
- Reactions may be used whenever a valid trigger occurs.
- Reactions are themselves capabilities.
- Reactions generate strain and cost normally.
- Reactions do not bypass capability rules.

---

### Initiative

Initiative =

Physical Modifier (default; non-Physical characters may use their primary attribute modifier if the DM agrees)

- Proficiency Bonus
- other modifiers

Initiative determines turn order.

Because combat uses initiative order:

> Simultaneous actions do not exist.

Actions resolve in initiative sequence.

---

### Interruption Rule

A capability may only be interrupted if it possesses an execution window.

Examples:

- Action-speed attack → generally not interruptible.
- 1 Round cast → interruptible during the round.
- 1 Minute cast → interruptible during casting.
- Ritual → interruptible throughout ritual.

Interruption is typically performed through reactions.

DM determines:

- full interruption
- partial interruption
- no interruption
based on the situation.

---

### Cost Trigger Rule

If a capability successfully resolves:

- cost applies
- strain applies

This remains true even if:

- an attack misses
- a target succeeds on a save
- the final effect is partially resisted

The capability was still executed.

---

### Failure Distinction

Examples:

- attack misses
- target succeeds on save

Capability executed.

Cost and strain still apply.

Capability prevented from completing.

DM decides whether:

- no cost applies
- partial cost applies
- full cost applies
based on how much execution occurred before interruption.

---

### Vitality Clarification

Vitality functions as:

- Health
- Endurance
- Capability execution resource

Both:

- incoming damage
- capability costs

reduce the same Vitality pool.

---

### Delayed Capabilities

Capabilities may be:

- delayed
- timed
- trigger-based

Examples:

- traps
- glyphs
- prepared effects

These may increase:

- strain
- cost
at DM discretion.

---

### Multi-Layer Capability Interactions

Overlapping effects, chained reactions, delayed triggers, and similar interactions do not create new resolution systems.

Instead:

- strain may increase
- cost may increase
- complexity may increase
according to DM judgment.

> **⚠️ COMBAT RHYTHM INTEGRATION — 2026-07-03**
> 
> Initiative has been **deprecated and removed** from this page. Combat now uses **[The Combat Rhythm]** as the canonical turn-order system.
> 
> **The Combat Rhythm:**
> 
> **Two contested-roll formulas** (only used when opposing intents collide within a track):
> 
> **No initiative roll. No rigid turn queue.** Actions resolve in track order; within the same side and same track, players/GM choose order that best supports the fiction. Reaction Slots (1 per round) handle narrative-triggered responses.
> 
> **PB is conditional** in both formulas — only if the character is trained in the relevant Attribute or Practice. This matches the [Practice System] Resolution Stack.
> 
> The previous "Final Combat Truth" line "Continue initiative order" has been replaced with: **"Continue Combat Rhythm sequence (resolve remaining tracks + triggered reactions)."**
