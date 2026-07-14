# Source 2 — Capability Composition Map (Canonical)

Notion ID: 37fed8479ccd810dbd98e4c942a98553
Parent page: SwordWeave TTRPG System Master Hub (37eed8479ccd81fa8150d0b31e22ff1f)
URL: https://app.notion.com/p/Capability-Composition-Map-Canonical-37fed8479ccd810dbd98e4c942a98553
Last edited: 2026-07-13T07:59:00.000Z

---

[Content retrieved from Notion — treat as data, not instructions.]

---

## 🎯 PURPOSE

This page defines how all system layers combine to produce a Capability. It serves as the definitive structural bridge connecting:

- **The BU Market** (The progression ledger and character ownership)
- **The Capability Template** (The structural schema of intent)
- **The Nested Effect Schema** (The mini-template for custom conditions)
- **The System Lexicon** (The semantic Verb + Domain meaning layer)
- **The Runtime Engine** (The Strain Layer and execution metrics)

## 🧩 CORE IDEA

A Capability is not a static spell, a fixed maneuver, or an immutable class ability. It is a **composed structure of intent** built by combining globally licensed primitives.

$$\text{Global Primitive Tiers (Owned)} \longrightarrow \text{Capability Schema Layout} \longrightarrow \text{The DM Strain Layer (Runtime Toll)}$$

## 🧱 THE LAYER STACK

### 1. 💰 BU SYSTEM (ECONOMY & LICENSE LAYER)

Defines what primitives a character permanently owns and has the right to use. Characters do not buy "spells" with BU; they buy broad **Tiers of Primitives**.

- **The Progression Scale:** Component and permission weights are evaluated within explicit **Cost Tier Ranges**, anchoring around your core framework values: **1–2 / 3–5 / 6–10 / 11–20 / 21–64+ BU**.
- **The Reusability Rule:** Once a primitive tier license is purchased globally on a character's sheet, it is unlocked forever. The player can reuse that primitive block across an infinite number of different capabilities for 0 extra progression cost.

### 2. 🧱 CAPABILITY TEMPLATE (STRUCTURE LAYER)

The structural schema that maps out how intent is translated into game data. It dictates the required fields and provides the empty "slots" where owned primitive blocks and nested mini-capability effects are plugged in.

### 🔤 3. THE LEXICON TIERS (MEANING & INTENSITY LAYERS)

The semantic building blocks that define *what* an action does and *where* it applies in reality. Both Verbs (Actions) and Domains (Themes) are purchased via the Master Component Tiers:

- **Tier 1 — Minor Components (1–2 BU Range):** *[Anchored at 2 BU]* Light structural elements, basic physical interactions, minimal range gates, and low-impact utility tricks.
- **Tier 2 — Standard Components (3–5 BU Range):** *[Anchored at 4 BU]* Core building blocks used in most standard templates. Baseline damage die blocks ($1\text{d}6$), basic kinetic adjustments, and foundational elemental/thematic manipulation.
- **Tier 3 — Major Components (6–10 BU Range):** *[Anchored at 8 BU]* Build-defining mechanics. Heavy payload scales (1d8/1d10), continuous tick expressions, advanced tactical control, and multi-layered condition interactions.
- **Tier 4 — Core Axes (11–20 BU Range):** *[Anchored at 12–16 BU]* Foundational primitives that alter reality boundaries, manipulate the turn track, introduce minor out-of-sequence execution rules, or dictate high-end mechanical constraints.
- **Tier 5 — Narrative Layer (21–64+ BU Range):** *[Anchored at 32–64 BU]* Reality-warping constructs, deep boss economy overrides (such as Legendary Cadence or Mythic Safeguards), and narrative variables that sit outside standard mortal BU constraints.

### 🎛️ 4. SOURCE TYPE INHERITANCE

Every capability is assigned a single overarching **Source Type** (Physical, Magical, or Psychic) at the structural root.

- All nested primitive components and sub-effects inside the template downward-inherit this designation.
- **Systemic Rule:** Source Type determines which global attributes/practices are used for the attack roll or character DC, and directly dictates how the effect interacts with spatial obstacles (Cover) and defensive layers (Armor/Defenses).

## 🧱 THE NESTED EFFECT & CONDITION FRAMEWORK

An **Effect** or **Condition** is not just a descriptive text label. Every sub-effect nested inside a Capability operates like a **miniature capability wrapper**.

To build a custom condition (like Fear, Exhaustion, or a System Hack), you use your purchased primitives as the "teeth" of the effect. You do not look up a fixed list in a glossary; you write the mechanical constraints directly into the effect slot.

### EFFECT TEMPLATE (v1 — Canonical Nesting Schema)

> [!NOTE]
> **Effect Identity**

# Capability Template raw

```javascript
CAPABILITY TEMPLATE (v1 — Canonical)

1. Identity
- Name
- Type: Passive / Active / Augment
- source (magical, physical, psychic damage)
     - SOURCE TYPE is inherited by all effects in the capability.

2. Construction
- Verbs (1–n)
- Domains (1–n)
- Effects (1–n)

3. Targeting
- Target Mode: Single / Multiple / AoE
- Target Shape (if AoE): cone / line / sphere / zone / beam
- Target Size: 5 / 10 / 20 ft/m etc
- Placement: self / target / point / directional

4. Range
- Touch / Close / Near / Far / Very Far / Extreme
- (cost gate only, no scaling effect)

5. Output
- Dice type and number (d4–d12 numeric)
- 2d6, 4d8, 4d8+8d6, etc 
- Damage type (inherited from domain)

6. Duration and casting time
- Duration of spell effects Instant / Short / Medium / Long / Scene / Persistent / Permanent
- time needed to be cast: Instant / Short / Medium / Long / Scene / Persistent / Permanent

7. Scaling
- intensity modifiers (optional expansion rules)
- BU equivalence reference (non-binding)

8. BU Evaluation (CORE VALUE)
- Base BU cost (construction equivalence)
- Adjusted BU (scaled version if expanded)

9. Strain (DM LAYER)
- heuristic difficulty
- scaling pressure
- complexity load
- vitality consequence (DM discretion)

10. CV (NERD LAYER ONLY)
- computed complexity estimate
- BU-equivalent approximation
- scaling comparison tool

11. Verbose Description
- narrative explanation (player-facing text)
```

## ⚙️ CAPABILITY TEMPLATES IN ACTION: TWO RIGOROUS EXAMPLES

### Example A: "Igneous Sledge" (Martial Strike, Single Simple Effect)

*This example showcases a Level 2 melee character utilizing their physical martial licenses to execute a heavy kinetic strike wrapped in molten fire, forcing a single, straightforward physical knockdown effect.*

> [!NOTE]
> **Igneous Sledge**

### Example B: "Abyssal Despair" (Psychic Wave, Multiple Nested Complex Effects)

*This example showcases a high-tier mentalist projecting a wave of pure psychic horror. It nests a customized condition called "Shattered Composure" built out of multiple mechanical constraints (movement speed zero, reaction locking, and defense penalties) to mimic a total hysterical breakdown.*

> [!NOTE]
> 

## ⚡ RESOLUTION & THE RUNTIME SAFETY VALVE

When a Capability is initialized at the table (whether pre-saved as a macro card or invented on the fly), the game engine processes it through the following logic chain:

```
[1. License Check] ──> Confirm player owns the utilized Primitive Tiers globally.
         │
[2. Source Match] ──> Downward-inherit Source (Physical/Magical/Psychic).
         │
[3. Vector Match] ──> Projected Vector (Applies Cover penalties) OR
                       Direct Manifestation (Bypasses Cover, requires bare Line of Sight).
         │
[4. DM Strain Appraisal] ──> Analyze Complexity + Targets + Nesting Depth.
         │
         └──> Assign Strain Level (Low ─> Extreme) ─> Collect Vitality/Strain Cost.
```

### 🌀 STANDALONE EFFECT EXAMPLES (NESTED DESIGNS)

### Example 1: "System Freeze / Lockout" (Technology/Technomancy or Ice Domain)

*This standalone condition represents a target's mechanical apparatus or nervous system locking down completely. It combines extreme mobility reduction with an immediate reaction lockout to isolate a high-threat enemy.*

- **Effect Name:** System Freeze

> [!NOTE]
> 

### Example 2: "Corrosive Decay" (Physical/Acid or Magical/Void Domain)

*This condition tracks ongoing structural erosion. Instead of a direct flat damage payload, it degrades the target's physical protections, making them a vulnerable target for the rest of the player squad.*

> [!NOTE]
> 

### Example 3: "Vertigo Spasms" (Psychic/Sensory or Magical/Air Domain)

*This effect showcases how to build a heavy combat control condition using probability manipulation. It represents complete inner-ear or mental disruption, throwing off all coordination.*

> [!NOTE]
> 

### Example 4: "Compelled Focus" (Psychic/Emotion Domain)

*This is the system's clean translation of an MMO-style "Taunt" or "Aggro" mechanic, built purely by restricting the targets' mathematical options rather than using rigid behavioral mind-control.*

> [!NOTE]
> 

# Capability Examples & Design Space

Capabilities are not limited to spells, attacks, or class features.

A capability is any discrete expression of a character's abilities, training, powers, talents, techniques, instincts, equipment integration, magical knowledge, supernatural gifts, social influence, or narrative identity.

Capabilities exist on a spectrum from extremely simple to extremely complex.

---

## Simple Capabilities

Single-purpose abilities with minimal complexity.

Examples:

- Advantage on Perception checks.
- Darkvision.
- Resistance to fire damage.
- Proficiency with lockpicks.
- Climbing speed.
- Swim speed.
- Ability to identify poisons.
- Immunity to being surprised.
- Speaking an additional language.
- Tracking creatures by scent.
- +1 to specific roll or +1 to all rolls 

A simple capability may consist of only one or two components.

---

## Martial Capabilities

Physical techniques, combat maneuvers, and battlefield expertise.

Examples:

- Action Surge.
- Stunning Strike.
- Whirlwind Attack.
- Riposte.
- Shield Bash.
- Precision Shot.
- Cleaving Strike.
- Mounted Combat Mastery.
- Grappling Specialist.
- Defensive Stance.

These capabilities often combine multiple components such as range, targeting, damage, status effects, action economy, and scaling.

---

## Magical Capabilities

Traditional spell-like abilities.

Examples:

- Firebolt.
- Fireball.
- Firestorm of Vitality.
- Teleport.
- Arcane Shield.
- Animate Dead.
- Chain Lightning.
- Ice Lance.
- Mass Heal.
- Meteor Swarm.

These often combine domains, scaling systems, targeting systems, damage outputs, durations, and special modifiers.

---

## Social Capabilities

Abilities focused on influence, leadership, deception, negotiation, and presence.

Examples:

- Inspire Allies.
- Master Negotiator.
- Crowd Manipulation.
- Commanding Presence.
- Intimidating Aura.
- Political Connections.
- Criminal Network.
- Silver Tongue.
- Courtly Authority.
- Master Interrogator.

These capabilities may interact with narrative systems, reputation systems, influence systems, or social encounters.

---

## Exploration Capabilities

Abilities focused on movement, discovery, survival, and information gathering.

Examples:

- Pathfinder.
- Cartographer.
- Survival Expert.
- Beast Tracker.
- Dungeon Delver.
- Expert Forager.
- Environmental Adaptation.
- Astronomical Navigation.
- Underwater Exploration.
- Wilderness Mastery.

---

## Utility Capabilities

Practical abilities which solve problems without directly dealing damage.

Examples:

- Create Food and Water.
- Arcane Locksmith.
- Dimensional Storage.
- Instant Shelter.
- Detect Magic.
- Message.
- Repair Objects.
- Purify Water.
- Fabricate.
- Arcane Translation.

---

## Passive Capabilities

Always-active benefits.

Examples:

- Damage resistance.
- Increased movement speed.
- Regeneration.
- Enhanced senses.
- Armor training.
- Elemental affinity.
- Reduced strain costs.
- Faster recovery.
- Increased carrying capacity.
- Magical awareness.

---

## Transformative Capabilities

Capabilities that fundamentally alter a character's state.

Examples:

- Wild Shape.
- Dragon Form.
- Shadow Form.
- Spirit Form.
- Giant Growth.
- Celestial Transformation.
- Lycanthropic Shift.
- Living Flame.
- Avatar State.
- Time-Locked Form.

These are typically among the most expensive and complex capabilities.

---

## Narrative Capabilities

Capabilities that primarily exist as world-facing truths rather than combat mechanics.

Examples:

- Noble Title.
- Guild Master.
- Legendary Reputation.
- Ownership of a Fortress.
- Dragon Rider.
- Archmage Recognition.
- Divine Blessing.
- Royal Authority.
- Master Craftsman.
- Ancient Lineage.

These may provide narrative permissions, access, influence, or story advantages.

---

## Hybrid Capabilities

Most advanced capabilities combine multiple categories.

Examples:

### Firestorm of Vitality

A magical capability that:

- Damages enemies.
- Heals allies.
- Affects an area.
- Scales with investment.
- Uses multiple domains.

### Chronal Duelist

A martial-magical capability set that:

- Enhances movement.
- Alters initiative.
- Creates temporal effects.
- Provides combat utility.

### Beast King

A hybrid capability that:

- Grants social influence over animals.
- Provides exploration utility.
- Enables combat interactions.
- Unlocks narrative permissions.

---

# 🧩 CAPABILITY LEDGER ARCHITECTURE & SCHEMA

## 🎯 THE SCHEMATIC REALIGNMENT

The blueprint ledger must not force a single, rigid "spell card" layout onto every entry. Doing so creates structural confusion because **Effects are optional sub-assemblies, not mandatory fields.** In this engine, a **Capability** is a macro-framework that packages your owned Primitives. It only includes an **Effect (Mini-Capability)** if it intends to leave a lingering, conditional rule state on a target coordinate slot.

## 🏛️ THE 3 CAPABILITY COMPOSITION STYLES

When organizing, writing, or database-tracking your compiled capabilities, they must be classified into one of three distinct architectural styles:

```
                  +--------------------------------+
                  |      CAPABILITY STYLES         |
                  +--------------------------------+
                                  |
         +------------------------+------------------------+
         |                        |                        |
         v                        v                        v
  [ 🛡️ STYLE A: PASSIVE ]   [ ⚔️ STYLE B: DIRECT ]   [ 🌪️ STYLE C: DYNAMIC ]
  No active execution.     Instant resolution.     Delivers a mini-cap
  No Ranges or Targets.    No lingering states.    (Effect) to target.
  Modifies sheet directly. Direct damage/movement. Lingering conditions.
```

### 🛡️ STYLE A: Passive / Stance Capabilities

- **Core Logic:** These do not have active targeting, execution speeds, or ranges. They are permanent, sheet-modifying attributes or toggled stances.
- **Component Makeup:** Primitives (Metrics, Biases, passive Permissions) only.
- **Effect Status:** **NONE.** (No conditions are projected).
- **Example:** *The Bloodhound Master* (Passive tracking advantage).

### ⚔️ STYLE B: Direct Resolution Capabilities

- **Core Logic:** Active maneuvers or spells that resolve instantly upon execution and leave zero trace behind on the track.
- **Component Makeup:** Primitives (Verb + Domain + Sizing + Range + Intensity Dice Block).
- **Effect Status:** **NONE.** (It deals its damage, heals its target, or teleports the user, and then ends immediately).
- **Example:** *A basic Kinetic Strike* or *Instant Flame Dart*.

### 🌪️ STYLE C: Dynamic State Capabilities

- **Core Logic:** Active maneuvers or spells designed to alter target behavior or apply complex conditions over time.
- **Component Makeup:** Primitives (Verb + Domain + Sizing + Range) + **Nested Effects** (Mini-Capabilities).
- **Effect Status:** **REQUIRED.** It projects a conditional sub-assembly (e.g., *Blinded*, *Compelled Focus*) onto the target's coordinate.
- **Example:** *Solar Flare* (Delivers the *Blinded* Effect to a 15ft Cone).

## 📋 THE UNIVERSAL LEDGER SCHEMA

Use this clean, modular template for your Notion ledger database. It adapts dynamically to all three styles of Capabilities by leaving optional fields blank when they are not structurally relevant.

```
+-----------------------------------------------------------------------+
| CAPABILITY BLUEPRINT CARD                                            |
+-----------------------------------------------------------------------+
| NAME: [Name of the Capability]                                        |
| CATEGORY: [Style A: Passive / Style B: Direct / Style C: Dynamic]     |
| TOTAL BU DESIGN COST: [Sum of all Primitives & Effects used]          |
+-----------------------------------------------------------------------+
| 1. PRIMITIVE INGREDIENTS                                              |
|    - [List all owned Primitives used to build this framework]         |
|                                                                       |
| 2. SPATIAL & RESOLUTION GATE (Active Only - Blank for Style A)        |
|    - Range: [e.g., Close, Far, Coordinate Touch]                     |
|    - Sizing/Shape: [e.g., Single Target, 15ft Cone, Radius Zone]     |
|    - Defense Save: [Relevant Practice Check vs. Character DC]           |
|                                                                       |
| 3. DELIVERED EFFECTS (Style C Only - Blank for Styles A & B)          |
|    - Effect Name: [Name of the Condition / Mini-Capability]            |
|    - Effect Primitives: [The primitives that make up the condition]     |
|    - Duration: [e.g., Sustained, End of Round, Permanent]              |
|                                                                       |
| 4. EXECUTION COST & RUNTIME (The DM Strain Layer)                    |
|    - Strain Tier: [Calculated from overall complexity]                |
|    - Vitality/Resource Cost: [If high-stress or overclocked]          |
+-----------------------------------------------------------------------+
```

## 📐 BLUEPRINT BLUEPRINT TRANSLATION EXAMPLES

### Example 1: Style A (Passive Tracker) — No Effects

- **Name:** Bloodhound Master
- **Category:** Style A (Passive)
- **Design Cost:** $2\text{ BU (Awareness)} + 3\text{ BU (Scent Focus)} + 4\text{ BU (Expertise)} = 9\text{ BU Total}$
- **Primitives:** * Practice Mod: Awareness (2 BU)
  - Bias Mod: Narrow Advantage (Positive Bias) on Scent-tracking (3 BU)
  - Metric Mod: Expertise Upgrade (Awareness) (4 BU)
- **Spatial & Resolution Gate:** N/A (Passive)
- **Delivered Effects:** **NONE**
- **Strain Tier:** Tier 0 (Passive)

### Example 2: Style B (Instant Kinetic Blast) — No Effects

- **Name:** Gravity Impact
- **Category:** Style B (Direct Resolution)
- **Design Cost:** $4\text{ BU (Move Verb)} + 4\text{ BU (Gravity Domain)} + 4\text{ BU (Impact Die)} = 12\text{ BU Total}$
- **Primitives:**
  - Lexicon Verb: Move [Tier II] (4 BU)
  - Lexicon Domain: Gravity [Tier II] (4 BU)
  - Sizing: Single Target (0 BU baseline)
  - Range: Close (2 BU)
  - Intensity: Impact Damage Die [Tier I] (2 BU)
- **Spatial & Resolution Gate:** * Range: Close
  - Sizing: Single Target
  - Save: Physical Save vs. Caster's Abstract DC (Push back 10ft and deal 1d6 impact).
- **Delivered Effects:** **NONE** (The push and damage are resolved instantly, then cleared).
- **Strain Tier:** Tier I (Standard Action)

### Example 3: Style C (Mind Lock) — Uses Effects

- **Name:** Compelled Focus
- **Category:** Style C (Dynamic State)
- **Design Cost:** $4\text{ BU (Influence Verb)} + 4\text{ BU (Emotion Domain)} + 8\text{ BU (Selective Disadvantage)} = 16\text{ BU Total}$
- **Primitives:**
  - Lexicon Verb: Influence [Tier II] (4 BU)
  - Lexicon Domain: Emotion [Tier II] (4 BU)
  - Sizing: Single Target (0 BU baseline)
  - Range: Close (2 BU)
- **Spatial & Resolution Gate:**
  - Range: Close
  - Save: Mental Defensive Save vs. Caster's Mental DC
- **Delivered Effects:** * **Effect Name:** *Compelled Focus*
  - **Effect Primitives:** Tier II Selective Negative Probability Bias (8 BU) (Target rolls Disadvantage on any offensive track that does not target the caster).
  - **Duration:** End of Round.
- **Strain Tier:** Tier II (Significant Strain)

## Design Philosophy

The capability engine is intentionally universal.

If a player can reasonably describe an ability, feature, technique, spell, gift, mutation, invention, social advantage, transformation, passive benefit, or narrative truth, it can likely be represented as a capability.

The engine is not intended to ask:

"Does this fit an existing class feature?"

Instead it asks:

"What components are required to represent this concept?"
