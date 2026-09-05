import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import type { Metadata } from "next";
import { PublicNav } from "@/components/home/public-nav";

// =============================================================================
// /character — From idea to character, with mirror and BU debt deep-dive.
//
// Companion to /start. /start gave you the recipe. This page is the cook-along:
// the actual decisions a player makes while sitting in front of a blank sheet,
// plus the full mechanics of the mirror system (per-primitive, runtime, slot
// polarity flip) and the BU budget curve.
//
// Source-of-truth: src/db/schema/engine.ts (primitives table) and
// src/lib/engine/mirror.ts (mirror vectors). Names and values below mirror
// those source files.
//
// Same avant-garde editorial language as the rest of the site. Server
// component, no DB, no client JS. PublicNav gives the top nav.
// =============================================================================

export const metadata: Metadata = {
  title: "Character creation · SwordWeave",
  description:
    "From idea to character. Mirror mechanics, BU budget curve, level-gated proficiency, and a worked example.",
};

// =============================================================================
// LEVEL → CUMULATIVE BU THRESHOLDS AND PROFICIENCY BONUS
//
// Source: Player's Handbook §4 Dynamic Leveling. Level is not a class tier.
// It is shorthand for your character's cumulative wealth (BU spent + held).
// When cumulative BU crosses a threshold, the level ticks up automatically.
// ============================================================================
const LEVEL_TABLE = [
  { level: 1, cumulative: 25, pb: 2, label: "thin. every BU counts." },
  { level: 2, cumulative: 35, pb: 2, label: "trained. one or two tricks." },
  { level: 3, cumulative: 45, pb: 2, label: "shaping up." },
  { level: 4, cumulative: 55, pb: 2, label: "competent specialist." },
  { level: 5, cumulative: 69, pb: 3, label: "PB bumps up." },
  { level: 6, cumulative: 79, pb: 3, label: "veteran." },
  { level: 7, cumulative: 89, pb: 3, label: "table-defining." },
  { level: 8, cumulative: 99, pb: 3, label: "near-mythic." },
  { level: 9, cumulative: 109, pb: 4, label: "PB bumps up again." },
  { level: 10, cumulative: 119, pb: 4, label: "regional threat." },
] as const;

// =============================================================================
// COST TIER VOCABULARY
//
// From the codex seed (src/db/seed/primitives.ts). The tier label on a
// primitive is descriptive — it tells you roughly how big the primitive is,
// NOT what level unlocks it. You can buy any tier at any level as long as
// you have the BU.
// =============================================================================
const TIER_LABELS = [
  { tier: "Tier 1 · Minor",    anchor: "~4 BU",     note: "small moves, fine control" },
  { tier: "Tier 2 · Standard", anchor: "~8 BU",     note: "the bread and butter of combat" },
  { tier: "Tier 3 · Major",    anchor: "~12 BU",    note: "scene-shaping effects" },
  { tier: "Tier 4 · Extreme",  anchor: "~16 BU",    note: "reality-warping consequences" },
] as const;

// =============================================================================
// MIRROR VECTOR TYPES
//
// Source: src/lib/engine/mirror.ts. The four canonical vector semantics.
// ============================================================================
const MIRROR_VECTORS = [
  {
    code: "STANDARD_ONLY",
    head: "pass-through",
    body: "Mirror does not change the modifier. The slot acquires the primitive in its normal direction. Useful for flavour primitives that have no clean inverse.",
    example: "language, lineage flavour, narrative permission",
  },
  {
    code: "VARIABLE_VECTOR",
    head: "sign flip",
    body: "Mirror flips the modifier's sign. A +5 Max HP becomes -5 Max HP. A +1 attack bonus becomes -1. The numerical primitives (Practice, Attribute, attack bonus, DC modifiers) use this.",
    example: "+5 HP -> -5 HP, +1 attack -> -1 attack",
  },
  {
    code: "STRUCTURAL_FAULT",
    head: "expose a weakness",
    body: "Mirror exposes the defensive primitive's load-bearing weakness. Standard form grants resistance (take 0.5x); mirror form makes the same row grant vulnerability (take 2x).",
    example: "resistance -> vulnerability, shield -> exposed gap",
  },
  {
    code: "COST_INSTABILITY",
    head: "instability penalty",
    body: "Mirror still places the modifier, but the user pays a runtime penalty each time they use it. Canonical case: Heuristic Buffer mirror, Vitality Shielding mirror (double vitality cost).",
    example: "shield that costs 2x vitality per use",
  },
] as const;

const SECTIONS = [
  {
    n: "01",
    title: "From idea to character",
    sub: "five decisions, in order",
    body: [
      "You already have the paragraph. Now you decide what your character can do about it. There are five decisions, and you make them in order so each one informs the next.",
      "Read this top to bottom the first time. After your first character, you will skim it.",
    ],
    decisions: [
      {
        tag: "1",
        head: "Attributes",
        body: "Ten points across Physical, Mental, Magical. These are not stats you roll against alone. They feed every DC and every check on the sheet. Free, no BU.",
      },
      {
        tag: "2",
        head: "Proficient attribute",
        body: "Pick the one your character is trained in. It is the only one that gets the Proficiency Bonus. Costs 10 BU. Trains with PB across every relevant roll.",
      },
      {
        tag: "3",
        head: "Primitives",
        body: "Buy the verbs, domains, outputs, geometry, and stat baselines you actually need. Each primitive has its own buCost and a tier label (Minor / Standard / Major / Extreme) that tells you roughly how big it is. You can buy any tier at any level. The tier label is descriptive, not a gate.",
      },
      {
        tag: "4",
        head: "Capability presets",
        body: "Write down the combinations you reach for most often. Free, because you already paid for the ingredients. Optional. Advanced players skip this and improvise from primitives at the table.",
      },
      {
        tag: "5",
        head: "Mirror what makes sense",
        body: "For each primitive you bought, decide whether to mirror it at the slot level. Mirror changes the polarity of the modifier when you use it, in exchange for a per-primitive BU credit back into your budget. Optional but powerful.",
      },
    ],
  },
  {
    n: "02",
    title: "Mirror, in one sentence",
    sub: "pay nothing for the primitive, choose polarity at use time, get a per-primitive refund",
    body: [
      "A primitive that is mirrorable carries a fixed mirrorBuCredit (a number). When you mirror the primitive at a slot, two things happen.",
      "One: when you actually USE that slot, the modifier applied is the mirrored polarity, not the standard one. This is decided at runtime, per use. You can flip it back on a future use if the fiction calls for it.",
      "Two: your budget is credited with mirrorBuCredit right away. That is your refund. You spend it on anything.",
    ],
    pullquote: "Mirror = per-primitive, per-slot, runtime polarity decision. The primitive is yours either way. The credit is yours either way.",
    example: {
      label: "Worked example, plain version",
      lines: [
        "Primitive        · Physical Edge        · 6 BU  · isMirrorable: true  · mirrorBuCredit: 3",
        "Lyra buys it.                              · -6 BU",
        "Lyra mirrors the slot.                     · +3 BU back into her budget",
        "When she uses Physical Edge in a capability,",
        "she can apply it as +4 OR as -4. Her call per use.",
      ],
    },
  },
  {
    n: "03",
    title: "The mechanics, end to end",
    sub: "how the mirror actually moves on the sheet",
    body: [
      "When you mirror a slot, four things happen.",
    ],
    rules: [
      "The primitive is still in your inventory permanently. Nothing changes about ownership.",
      "The slot's USE of the primitive defaults to the mirrored polarity. The standard polarity is still available, you just have to opt into it per use at the table.",
      "Your budget is credited with the primitive's mirrorBuCredit. This is a fixed integer on the primitive itself, not a percentage of cost.",
      "There is no global cap on mirror refunds per level. Each primitive's mirrorBuCredit is independent. Some primitives refund 0 (they are mirrorable but the credit is zero). Some refund 3. Some refund 8. Read the primitive's card.",
    ],
    after: [
      "Budget movement, plain version:",
    ],
    formula: {
      label: "Budget movement",
      lines: [
        "starting budget                    25 BU   (Level 1)",
        "buy Physical Edge (6 BU)           -6 BU",
        "mirror Physical Edge slot          +3 BU   (mirrorBuCredit, fixed)",
        "buy Space Domain (12 BU)          -12 BU",
        "mirror Space Domain slot           +5 BU   (its own mirrorBuCredit)",
        "                                      ─────",
        "effective budget used                 10 BU used  +  8 BU debt collected",
      ],
    },
  },
  {
    n: "04",
    title: "Verb tiers, domain tiers, and tier labels",
    sub: "tier is a label, not a gate",
    body: [
      "In the codex, every primitive carries a costTier label. The vocabulary is fixed: Tier 1 Minor, Tier 2 Standard, Tier 3 Major, Tier 4 Extreme. Each label is anchored to a roughly-bigger BU range.",
      "The tier label tells you how big the primitive is. It does NOT tell you what level unlocks it. You can buy a Tier 4 Extreme primitive at Level 1 if you have the BU and the table agrees. You can buy a Tier 1 Minor primitive at Level 10. Nothing prevents either.",
      "Verb tiers and domain tiers are just categories of primitives. A verb primitive (Strike, Move, Control, Heal) has a tier label. A domain primitive (Fire, Gravity, Space, Mind, Time, Life) has a tier label. Buy as many of each as you want, at any tier, at any level. The only thing that scales with level is your cumulative BU budget and your Proficiency Bonus.",
    ],
    table_intro: "Tier labels and what they roughly mean:",
    note: "These anchors are descriptive. The actual buCost is set per primitive in the codex. The tier label is a name, not a multiplier.",
  },
  {
    n: "05",
    title: "What can mirror",
    sub: "it depends on the primitive, not on the player",
    body: [
      "Each primitive declares whether it is mirrorable (isMirrorable boolean) and what its mirror vector is (one of the four types in the next section).",
      "Flavour primitives (language, lineage notes, narrative permission) usually mirror as STANDARD_ONLY. They pass through. The credit is real even if the polarity flip is meaningless.",
      "Numerical primitives (attribute modifiers, attack bonuses, DC adjustments) usually mirror as VARIABLE_VECTOR. Sign flip.",
      "Defensive primitives (resistance rows, shields) usually mirror as STRUCTURAL_FAULT. The defensive bonus becomes a vulnerability.",
      "Strain buffers and vitality shields usually mirror as COST_INSTABILITY. The modifier is still applied, but the user pays a per-use runtime penalty.",
    ],
    mirror_vs: [
      {
        kind: "cleanly mirrorable",
        examples: [
          "Attribute +1 to +4 (numerical, VARIABLE_VECTOR)",
          "Attack Bonus +1 to +3 (numerical, VARIABLE_VECTOR)",
          "Damage Resistance (defensive, STRUCTURAL_FAULT into Vulnerability)",
          "Heuristic Buffer (COST_INSTABILITY into unstable form)",
          "Skill Proficiency (VARIABLE_VECTOR, training becomes untrained penalty)",
        ],
      },
      {
        kind: "mirror is meaningless",
        examples: [
          "Language licences (flavour, STANDARD_ONLY)",
          "Lineage notes (narrative, STANDARD_ONLY)",
          "Domain access for thematic-only mediums",
          "Any primitive whose mirrorBuCredit is 0 in the codex",
        ],
      },
    ],
  },
  {
    n: "06",
    title: "When you slot it",
    sub: "per-use polarity decision at the table",
    body: [
      "This is the part people get wrong. Mirroring is a slot-level decision, made when you USE the slot, not when you create the slot.",
      "Lyra buys Physical Edge (mirrorable, credit 3). She mirrors the slot. The slot defaults to the mirrored polarity (-4 Physical). If at the table, in a specific moment, she needs to be strong, she opts into the standard polarity (+4). The capability card writes itself either way. The cost was already paid at character creation.",
      "This is the part that makes mirror interesting. You are not locked into the disadvantage forever. You are paying a baseline disadvantage in exchange for budget, and you retain the option to use the original direction whenever the fiction calls for it. The GM and the table adjudicate which way a slot resolves, moment by moment.",
    ],
    pullquote: "Mirror is a polarity you can flip. The credit is the price of having the choice.",
  },
  {
    n: "07",
    title: "The four mirror vectors",
    sub: "the engine's actual vocabulary",
    body: [
      "These are the four canonical mirror vectors defined in the engine. Each primitive declares one.",
    ],
    vectors: MIRROR_VECTORS,
    after_vectors: [
      "Not every primitive uses every vector. The vector is set per primitive in the codex and shown on the primitive's card. When in doubt, read the card.",
    ],
  },
  {
    n: "08",
    title: "Lyra, end to end",
    sub: "a worked character with two mirrors",
    body: [
      "Lyra is a void-walker hiding from the salt-mines company. Let us build her at Level 1 with two mirrored slots and see how the budget closes.",
    ],
    lyra: [
      {
        label: "Base",
        lines: [
          "Level 1                            25 BU",
          "Proficient attribute (Magical)    -10 BU",
          "10 free attribute points           (distributed: Magical +4, Mental +3, Physical +3)",
        ],
      },
      {
        label: "What she buys",
        lines: [
          "Strike verb (Tier 2 Standard)     -4 BU   mirrorable, mirrorBuCredit: 2",
          "Space domain (Tier 3 Major)       -12 BU  mirrorable, mirrorBuCredit: 5",
          "Damage 1d8 Magical                 -5 BU",
          "Range Close gate                  -2 BU",
          "Single Target                     included",
          "Single Target switched to AoE Cone via refund",
          "Mirror Strike slot                 +2 BU   (VARIABLE_VECTOR)",
          "Mirror Space slot                  +5 BU   (VARIABLE_VECTOR for Space is unusual)",
          "                                                          ─────────────────",
          "effective spend                    -20 BU used",
          "mirror credits collected            +7 BU back into budget",
          "remaining                          12 BU (rolled into gear, saved, or spent at the table)",
        ],
      },
      {
        label: "What she carries",
        lines: [
          "attributes    · Physical +3, Mental +3, Magical +4",
          "proficient    · Magical (PB +2 at Level 1)",
          "verb          · Strike (mirrored slot, polarity decision per use)",
          "domain        · Space (mirrored slot, polarity decision per use)",
          "damage        · 1d8 Magical",
          "range         · Close",
          "targeting     · Single or AoE Cone",
          "remaining     · 12 BU held for mid-scene purchases or new mirrors",
        ],
      },
      {
        label: "At the table",
        lines: [
          "She opens a wormhole to escape the sentry. The slot resolves as the",
          "mirrored polarity: her Space slot is anti-space, the wormhole she",
          "opens wants to collapse. She accepts the GM's Strain cost, pays the",
          "Vitality, rolls d20 + Magical + PB + capability modifier.",
          "",
          "Next turn, she needs to carry a wounded miner out. She reaches for",
          "the Space slot again, this time opting into the standard polarity:",
          "she folds the room to make a corridor that didn't exist a second ago.",
          "Same primitive. Same capability card. Different polarity, different",
          "fiction, different moment.",
        ],
      },
    ],
  },
  {
    n: "09",
    title: "Heuristics, not rules",
    sub: "the mirror is yours to bend",
    body: [
      "The mirror vectors, the per-primitive credits, and the polarity semantics are defined in the engine. You can read the source code to verify any of this. But like the rest of the system, the mechanic is a heuristic.",
      "If your table wants a different mirror credit for a primitive, fork the primitive and publish your version. If you want a global cap on mirror refunds per character, discuss it. If you want mirror to be free (no credit at all), or expensive (cost MORE than the standard buy), those are all valid table decisions.",
      "There is no wrong answer. The mechanic exists because players wanted a way to build weirder characters without breaking the budget. Tune it until your table is having fun.",
    ],
    signoff: true,
  },
] as const;

export default function CharacterPage() {
  return (
    <div className="sw-home relative mx-auto w-full max-w-[1400px] px-4 pb-24 pt-16 sm:px-6 sm:pt-16 lg:px-10 lg:pt-16">
      <PublicNav />

      <div className="sw-marginalia sw-marginalia--top mb-10 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-border pb-3 text-[10px] uppercase tracking-[0.22em] text-muted-foreground sm:text-xs">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
          <Link href="/" className="font-display text-foreground hover:text-primary">
            Sword<span className="text-primary">·</span>Weave
          </Link>
          <span>Character creation</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
          <span aria-hidden className="text-primary/70">
            §00–§90 · nine sections
          </span>
          <Link href="/start" className="hover:text-foreground">
            Walkthrough
          </Link>
          <Link href="/codex" className="inline-flex items-center gap-1 hover:text-foreground">
            Open the codex
            <ArrowUpRight className="size-3" />
          </Link>
        </div>
      </div>

      <section className="sw-hero relative grid gap-6 pb-12 sm:pb-16 lg:grid-cols-[64px_1fr] lg:gap-10 lg:pb-20">
        <div aria-hidden className="sw-running-head hidden lg:block">
          <span>SW · CHARACTER · MIRROR</span>
        </div>

        <div className="min-w-0">
          <div className="mb-3 inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.28em] text-primary lg:hidden">
            <span className="size-1.5 rounded-full bg-primary" />
            Character creation
          </div>

          <h1 className="font-display text-[clamp(2.25rem,7vw,5.5rem)] font-bold uppercase leading-[0.9] tracking-tight">
            <span className="block">From intent</span>
            <span className="block">
              to a <span className="sw-headline__under">real</span> character,
            </span>
            <span className="block text-muted-foreground">one decision at a time.</span>
          </h1>

          <p className="mt-6 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
            Five decisions to a character. A mirror system that lives on every
            primitive, with a per-primitive credit back into your budget in
            exchange for a slot-level polarity decision at the table. By the
            end of this page you will have built one character and seen the
            mirror work end to end.
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link
              href="#sec-1"
              className="sw-cta-primary inline-flex h-11 items-center gap-2 bg-primary px-5 text-sm font-bold uppercase tracking-[0.12em] text-primary-foreground"
            >
              Start at §01
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/start"
              className="sw-cta-ghost inline-flex h-11 items-center gap-2 border border-border bg-card px-5 text-sm font-bold uppercase tracking-[0.12em] text-foreground hover:border-primary/60 hover:text-primary"
            >
              First, the walkthrough
            </Link>
          </div>
        </div>
      </section>

      {/* At-a-glance panel — mirror in one read */}
      <section className="sw-section relative border-y border-border bg-card/40 py-12 sm:py-16 lg:py-20">
        <SectionHeading
          index="§00"
          eyebrow="At a glance"
          title="The mirror in one read"
          deck="Below is the whole mechanic on one panel. Skim it now, then walk the nine sections below for the worked example and the level table."
        />

        <div className="mt-10 grid gap-px overflow-hidden border border-border bg-border sm:grid-cols-3">
          <div className="flex flex-col gap-2 bg-card p-5 sm:p-6">
            <span className="font-display text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              What it costs
            </span>
            <p className="font-display text-2xl font-bold uppercase leading-none">
              The primitive's own price
            </p>
            <p className="text-xs text-muted-foreground sm:text-sm">
              Mirror does not change the primitive's cost. You still buy it normally. Mirror is a slot-level choice, not a buy option.
            </p>
          </div>
          <div className="flex flex-col gap-2 bg-card p-5 sm:p-6">
            <span className="font-display text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              What you get back
            </span>
            <p className="font-display text-2xl font-bold uppercase leading-none">
              mirrorBuCredit
            </p>
            <p className="text-xs text-muted-foreground sm:text-sm">
              A fixed integer on the primitive itself, not a percentage. Credit 0 to 8 typically. The credit is yours whether you use the mirror or not.
            </p>
          </div>
          <div className="flex flex-col gap-2 bg-card p-5 sm:p-6">
            <span className="font-display text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              When it flips
            </span>
            <p className="font-display text-2xl font-bold uppercase leading-none">
              Per use, at the table
            </p>
            <p className="text-xs text-muted-foreground sm:text-sm">
              The slot defaults to mirrored polarity. You can opt into standard polarity any time the fiction calls for it. The decision is per use.
            </p>
          </div>
        </div>

        <p className="mt-6 max-w-2xl text-xs leading-6 text-muted-foreground sm:text-sm sm:leading-7">
          And the part people miss: mirror is per primitive, declared on the
          primitive's card in the codex. Some primitives mirror cleanly,
          some mirror for flavour only, some do not mirror at all. Read the
          primitive's card before you mirror it.
        </p>
      </section>

      {/* The nine sections */}
      <section className="sw-section py-14 sm:py-20 lg:py-24">
        <ol className="space-y-16 sm:space-y-20 lg:space-y-24">
          {SECTIONS.map((section, i) => (
            <li
              key={section.n}
              id={`sec-${i + 1}`}
              className="grid scroll-mt-24 gap-6 border-t border-border pt-10 sm:gap-8 lg:grid-cols-[120px_1fr] lg:gap-12"
            >
              <header className="flex flex-row items-baseline gap-3 lg:flex-col lg:items-start lg:gap-1">
                <span className="font-display text-4xl font-bold leading-none text-primary sm:text-5xl">
                  {section.n}
                </span>
                <span className="font-display text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                  §{i}0
                </span>
              </header>

              <div className="min-w-0">
                <h2 className="font-display text-3xl font-bold uppercase leading-[0.95] tracking-tight sm:text-4xl lg:text-5xl">
                  {section.title}
                </h2>
                <p className="mt-2 font-display text-xs uppercase tracking-[0.22em] text-primary sm:text-sm">
                  {section.sub}
                </p>

                {"body" in section &&
                  section.body.map((para, j) => (
                    <p
                      key={j}
                      className="mt-5 text-sm leading-7 text-foreground sm:text-base sm:leading-8"
                    >
                      {para}
                    </p>
                  ))}

                {/* Decisions list (section 1) */}
                {"decisions" in section && section.decisions && (
                  <ol className="mt-7 space-y-4">
                    {section.decisions.map((d) => (
                      <li
                        key={d.tag}
                        className="grid grid-cols-[auto_1fr] gap-4 border-l-2 border-primary pl-4"
                      >
                        <span className="font-display text-xl font-bold text-primary sm:text-2xl">
                          {d.tag}
                        </span>
                        <div className="min-w-0">
                          <p className="font-display text-base font-bold uppercase tracking-tight sm:text-lg">
                            {d.head}
                          </p>
                          <p className="mt-1 text-sm leading-6 text-foreground sm:text-base sm:text-base sm:leading-7">
                            {d.body}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}

                {/* Pullquote (sections 2 and 6) */}
                {"pullquote" in section && section.pullquote && (
                  <blockquote className="sw-tenet__signoff mt-7 max-w-2xl border-l-2 border-primary pl-4 font-display text-lg uppercase italic text-muted-foreground sm:text-xl">
                    {section.pullquote}
                  </blockquote>
                )}

                {/* Example card (section 2) */}
                {"example" in section && section.example && (
                  <figure className="sw-recipe mt-6 border border-border bg-card p-5 sm:p-6">
                    <figcaption className="font-display text-[10px] uppercase tracking-[0.22em] text-primary">
                      {section.example.label}
                    </figcaption>
                    <pre className="mt-3 whitespace-pre-wrap font-display text-xs leading-[1.7] text-foreground sm:text-sm">
                      {section.example.lines.join("\n")}
                    </pre>
                  </figure>
                )}

                {/* Rules list (section 3) */}
                {"rules" in section && section.rules && (
                  <>
                    <ul className="mt-6 space-y-3">
                      {section.rules.map((rule, j) => (
                        <li
                          key={j}
                          className="grid grid-cols-[auto_1fr] gap-3 border-l-2 border-primary/40 pl-4 text-sm leading-7 text-foreground sm:text-base sm:leading-8"
                        >
                          <span className="font-display text-xs uppercase tracking-[0.22em] text-primary">
                            {String(j + 1).padStart(2, "0")}
                          </span>
                          <span>{rule}</span>
                        </li>
                      ))}
                    </ul>
                    {"after" in section && section.after && (
                      <div className="mt-5 space-y-3 text-sm leading-7 text-muted-foreground sm:text-base sm:leading-8">
                        {section.after.map((para, j) => (
                          <p key={j}>{para}</p>
                        ))}
                      </div>
                    )}
                    {"formula" in section && section.formula && (
                      <figure className="sw-recipe mt-6 border border-border bg-card p-5 sm:p-6">
                        <figcaption className="font-display text-[10px] uppercase tracking-[0.22em] text-primary">
                          {section.formula.label}
                        </figcaption>
                        <pre className="mt-3 whitespace-pre-wrap font-display text-xs leading-[1.7] text-foreground sm:text-sm">
                          {section.formula.lines.join("\n")}
                        </pre>
                      </figure>
                    )}
                  </>
                )}

                {/* Tier table (section 4) */}
                {"table_intro" in section && section.table_intro && (
                  <>
                    <p className="mt-5 text-sm leading-7 text-foreground sm:text-base sm:leading-8">
                      {section.table_intro}
                    </p>
                    <div className="mt-5 overflow-x-auto border border-border bg-card">
                      <table className="w-full min-w-[560px] border-collapse text-left">
                        <thead>
                          <tr className="border-b border-border bg-card/60">
                            <th className="px-4 py-3 font-display text-[10px] uppercase tracking-[0.22em] text-primary">
                              Tier label
                            </th>
                            <th className="px-4 py-3 font-display text-[10px] uppercase tracking-[0.22em] text-primary">
                              BU anchor
                            </th>
                            <th className="hidden px-4 py-3 font-display text-[10px] uppercase tracking-[0.22em] text-muted-foreground sm:table-cell">
                              Rough scale
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {TIER_LABELS.map((row) => (
                            <tr
                              key={row.tier}
                              className="border-b border-border/50 last:border-0"
                            >
                              <td className="px-4 py-3 font-display text-sm font-bold uppercase sm:text-base">
                                {row.tier}
                              </td>
                              <td className="px-4 py-3 font-display text-base sm:text-lg">
                                {row.anchor}
                              </td>
                              <td className="hidden px-4 py-3 text-xs text-muted-foreground sm:table-cell">
                                {row.note}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {"note" in section && section.note && (
                      <p className="mt-4 max-w-2xl border-l-2 border-primary/40 pl-3 text-xs italic leading-6 text-muted-foreground sm:text-sm sm:leading-7">
                        {section.note}
                      </p>
                    )}
                  </>
                )}

                {/* Mirror vs table discretion (section 5) */}
                {"mirror_vs" in section && section.mirror_vs && (
                  <div className="mt-7 grid gap-px overflow-hidden border border-border bg-border sm:grid-cols-2">
                    {section.mirror_vs.map((col) => (
                      <div key={col.kind} className="bg-card p-5 sm:p-6">
                        <p className="font-display text-[10px] uppercase tracking-[0.22em] text-primary">
                          {col.kind}
                        </p>
                        <ul className="mt-3 space-y-2">
                          {col.examples.map((ex, j) => (
                            <li
                              key={j}
                              className="border-l-2 border-primary/30 pl-3 text-sm leading-6 text-foreground sm:text-base sm:leading-7"
                            >
                              {ex}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}

                {/* Mirror vectors (section 7) */}
                {"vectors" in section && section.vectors && (
                  <>
                    <div className="mt-7 grid gap-px overflow-hidden border border-border bg-border sm:grid-cols-2">
                      {section.vectors.map((v) => (
                        <div key={v.code} className="bg-card p-5 sm:p-6">
                          <p className="font-display text-[10px] uppercase tracking-[0.22em] text-primary">
                            {v.code}
                          </p>
                          <p className="mt-1 font-display text-lg font-bold uppercase tracking-tight sm:text-xl">
                            {v.head}
                          </p>
                          <p className="mt-2 text-sm leading-6 text-foreground sm:text-base sm:leading-7">
                            {v.body}
                          </p>
                          <p className="mt-3 border-l-2 border-primary/30 pl-3 font-display text-xs italic text-muted-foreground">
                            {v.example}
                          </p>
                        </div>
                      ))}
                    </div>
                    {"after_vectors" in section && section.after_vectors && (
                      <p className="mt-5 max-w-2xl border-l-2 border-primary/40 pl-3 text-sm italic leading-7 text-muted-foreground sm:text-base sm:leading-8">
                        {section.after_vectors}
                      </p>
                    )}
                  </>
                )}

                {/* Lyra worked example (section 8) */}
                {"lyra" in section && section.lyra && (
                  <div className="mt-7 grid gap-4 lg:grid-cols-2">
                    {section.lyra.map((block) => (
                      <figure
                        key={block.label}
                        className="sw-recipe border border-border bg-card p-5 sm:p-6"
                      >
                        <figcaption className="font-display text-[10px] uppercase tracking-[0.22em] text-primary">
                          {block.label}
                        </figcaption>
                        <pre className="mt-3 whitespace-pre-wrap font-display text-xs leading-[1.7] text-foreground sm:text-sm">
                          {block.lines.join("\n")}
                        </pre>
                      </figure>
                    ))}
                  </div>
                )}

                {/* Signoff (section 9) */}
                {"signoff" in section && section.signoff && (
                  <p className="sw-tenet__signoff mt-8 max-w-2xl border-l-2 border-primary pl-4 font-display text-base uppercase italic text-muted-foreground sm:text-lg">
                    The mirror is yours to bend. Tune it until your table is
                    having fun.
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Level table — explicit "level does not gate tier" reference */}
      <section className="sw-section border-t border-border pt-10 sm:pt-14">
        <SectionHeading
          index="§10"
          eyebrow="What level actually unlocks"
          title="The level table"
          deck="Level is shorthand for cumulative BU earned. Nothing else gates on level. Tier is a label on each primitive, not a level requirement."
        />
        <div className="mt-6 overflow-x-auto border border-border bg-card">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <thead>
              <tr className="border-b border-border bg-card/60">
                <th className="px-4 py-3 font-display text-[10px] uppercase tracking-[0.22em] text-primary">
                  Level
                </th>
                <th className="px-4 py-3 font-display text-[10px] uppercase tracking-[0.22em] text-primary">
                  Cumulative BU
                </th>
                <th className="px-4 py-3 font-display text-[10px] uppercase tracking-[0.22em] text-primary">
                  PB
                </th>
                <th className="hidden px-4 py-3 font-display text-[10px] uppercase tracking-[0.22em] text-muted-foreground sm:table-cell">
                  Note
                </th>
              </tr>
            </thead>
            <tbody>
              {LEVEL_TABLE.map((row) => (
                <tr
                  key={row.level}
                  className="border-b border-border/50 last:border-0"
                >
                  <td className="px-4 py-3 font-display text-sm font-bold uppercase sm:text-base">
                    Level {row.level}
                  </td>
                  <td className="px-4 py-3 font-display text-base sm:text-lg">
                    {row.cumulative} BU
                  </td>
                  <td className="px-4 py-3 font-display text-base text-primary sm:text-lg">
                    +{row.pb}
                  </td>
                  <td className="hidden px-4 py-3 text-xs text-muted-foreground sm:table-cell">
                    {row.label}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 max-w-2xl border-l-2 border-primary/40 pl-3 text-xs italic leading-6 text-muted-foreground sm:text-sm sm:leading-7">
          PB bumps at Level 5 and Level 9. Cumulative BU is the threshold
          that triggers the level-up. Everything else (attribute, proficient
          attribute, primitives, mirror) is yours to decide on regardless of
          level.
        </p>
      </section>

      {/* Closing CTA */}
      <section className="sw-section border-t border-border pt-12 sm:pt-16">
        <div className="grid gap-6 sm:grid-cols-2 sm:gap-8">
          <Link
            href="/start"
            className="sw-codex-card group flex items-baseline justify-between gap-4 border border-border bg-card p-5 transition-colors hover:border-primary/60 sm:p-6"
          >
            <div className="min-w-0">
              <p className="font-display text-[10px] uppercase tracking-[0.22em] text-primary">
                Need the basics first?
              </p>
              <p className="mt-1 font-display text-2xl font-bold uppercase leading-none sm:text-3xl">
                The walkthrough
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Eight steps from intent to first roll. No database, no
                account, no menu of classes.
              </p>
            </div>
            <ArrowRight className="size-5 shrink-0 text-primary transition-transform group-hover:translate-x-1" />
          </Link>

          <Link
            href="/combat"
            className="sw-codex-card group flex items-baseline justify-between gap-4 border border-border bg-card p-5 transition-colors hover:border-primary/60 sm:p-6"
          >
            <div className="min-w-0">
              <p className="font-display text-[10px] uppercase tracking-[0.22em] text-primary">
                Built the character. now what?
              </p>
              <p className="mt-1 font-display text-2xl font-bold uppercase leading-none sm:text-3xl">
                The combat rhythm
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                The Council Phase, the three complexity tracks, the reaction
                slot, and how action economy works at the table.
              </p>
            </div>
            <ArrowRight className="size-5 shrink-0 text-primary transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </section>
    </div>
  );
}

function SectionHeading({
  index,
  eyebrow,
  title,
  deck,
}: {
  index: string;
  eyebrow: string;
  title: string;
  deck: string;
}) {
  return (
    <header className="sw-section-head grid gap-4 lg:grid-cols-[64px_1fr] lg:gap-10">
      <span className="hidden font-display text-xs uppercase tracking-[0.22em] text-primary lg:block">
        {index}
      </span>
      <div className="min-w-0">
        <span className="mb-2 hidden text-xs uppercase tracking-[0.22em] text-muted-foreground lg:inline">
          {eyebrow}
        </span>
        <span className="font-display text-[10px] uppercase tracking-[0.28em] text-primary lg:hidden">
          {index} · {eyebrow}
        </span>
        <h2 className="font-display text-3xl font-bold uppercase leading-[0.95] tracking-tight sm:text-5xl lg:text-6xl">
          {title}
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base sm:leading-7">
          {deck}
        </p>
      </div>
    </header>
  );
}
