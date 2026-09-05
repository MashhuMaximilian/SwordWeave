import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import type { Metadata } from "next";
import { PublicNav } from "@/components/home/public-nav";

// =============================================================================
// /character — From idea to character, with mirror and BU debt deep-dive.
//
// Companion to /start. /start gave you the recipe. This page is the cook-along:
// the actual decisions a player makes while sitting in front of a blank sheet,
// plus the full mechanics of the mirror system (pay nothing, gain something,
// give up something else) and the BU debt it produces.
//
// Same avant-garde editorial language. Same SectionHeading pattern. Server
// component, no DB, no client JS. PublicNav gives the top nav.
// =============================================================================

export const metadata: Metadata = {
  title: "Character creation · SwordWeave",
  description:
    "From idea to character. Mirror mechanics, BU debt, level-range caps, and a worked example.",
};

// =============================================================================
// LEVEL-RANGE BUDGETS AND MIRROR CAPS
//
// These numbers are a starting suggestion, not a rule. Discuss with your
// table. The system is a heuristic, the homepage tenets said so.
// =============================================================================
const LEVEL_TABLE = [
  {
    range: "Level 1",
    tier: "Tier I",
    starting: 25,
    cap: 5,
    note: "thin. every BU counts.",
  },
  {
    range: "Levels 2 to 4",
    tier: "Tier II",
    starting: 50,
    cap: 10,
    note: "comfortable. mirror trade-offs start to feel real.",
  },
  {
    range: "Levels 5 to 7",
    tier: "Tier III",
    starting: 80,
    cap: 15,
    note: "specialist builds. mirror refund can fund a whole second verb tier.",
  },
  {
    range: "Levels 8 to 10",
    tier: "Tier IV",
    starting: 120,
    cap: 20,
    note: "reality-warper. mirror caps stop being the bottleneck.",
  },
  {
    range: "Levels 11 plus",
    tier: "Tier V plus",
    starting: 150,
    cap: 25,
    note: "narrative tier. the GM and the table decide what feels right.",
  },
] as const;

const SECTIONS = [
  {
    n: "01",
    title: "From idea to character",
    sub: "six decisions, in order",
    body: [
      "You already have the paragraph. Now you decide what your character can do about it. There are six decisions, and you make them in order so each one informs the next.",
      "Read this top to bottom the first time. After your first character, you will skim it.",
    ],
    decisions: [
      {
        tag: "1",
        head: "Attributes",
        body: "Ten points across Physical, Mental, Magical. These are not stats you roll against alone. They feed every DC and every check on the sheet.",
      },
      {
        tag: "2",
        head: "Proficient attribute",
        body: "Pick the one your character is trained in. It is the only one that gets the Proficiency Bonus. Costs 10 BU.",
      },
      {
        tag: "3",
        head: "Verb tier",
        body: "Buy one verb tier with BU. You get every verb in that tier, free to use, plus any custom verbs the table agrees belong in it.",
      },
      {
        tag: "4",
        head: "Domain tier",
        body: "Buy one domain tier. That is the medium you channel intent through. Fire, Gravity, Space, Mind, Time, Life. Once owned, free to use for flavour, not slotted into capabilities.",
      },
      {
        tag: "5",
        head: "Outputs and geometry",
        body: "Damage dice (1d4 to 1d20, with a source type). Status infliction. Range. Targeting. Buy what your character actually needs.",
      },
      {
        tag: "6",
        head: "Mirror what you can",
        body: "This is where the BU debt comes in. You can take a few disadvantages to claw back some budget. Read the next section before you decide.",
      },
    ],
  },
  {
    n: "02",
    title: "Mirror, in one sentence",
    sub: "pay nothing, gain something, give up something else",
    body: [
      "A primitive usually costs X BU and gives you +Y of something. To mirror it is to take the primitive for free, but with -Y of that something instead of +Y.",
      "You do not get the -Y and the +Y. You get the -Y. That is the whole deal.",
      "As a bonus for accepting the disadvantage, the GM refunds a portion of the original X BU back into your starting budget. That refund is your BU debt. We will call it mirror refund to keep it short.",
    ],
    pullquote: "Mirror = accept a permanent disadvantage, get the primitive for free, plus a partial refund of its BU cost into your budget.",
    example: {
      label: "Worked example, plain version",
      lines: [
        "Primitive   · Physical Edge        · 6 BU  · +4 Physical checks",
        "Lyra mirrors it.                          · 0 BU  · -4 Physical checks instead",
        "GM refunds 3 BU back into her budget.     · she spends those 3 BU elsewhere.",
      ],
    },
  },
  {
    n: "03",
    title: "The mechanics",
    sub: "how the mirror refund actually moves on the sheet",
    body: [
      "When you mirror, three things happen at the same time.",
    ],
    rules: [
      "The primitive enters your inventory for 0 BU. You own it permanently.",
      "The mirrored direction (-Y instead of +Y) is your default. That is what shows up on the sheet.",
      "The GM credits your budget with the mirror refund. You spend it on any other primitive, like normal BU.",
    ],
    after: [
      "The refund is not a separate pool. It is added to your starting BU and tracked the same way as every other unit you spent.",
    ],
    formula: {
      label: "Budget movement",
      lines: [
        "starting budget          25 BU   (Level 1)",
        "minus original cost       0 BU   (you mirrored, not bought)",
        "plus mirror refund       3 BU   (50% of the 6 BU primitive, illustrative)",
        "                                  ─────────────────",
        "new effective budget     28 BU   (treat it like normal BU)",
      ],
    },
  },
  {
    n: "04",
    title: "BU debt and the per-range cap",
    sub: "mirroring is free, but not infinite",
    body: [
      "The mirror refund is capped per level range. You cannot mirror your way to infinity. The cap is on the total refund you can collect in that range, not on the number of primitives you mirror.",
      "Lyra at Level 1 can collect up to 5 BU in mirror refund. So she can mirror a 6 BU primitive (gets 3 BU back, fine), or two 4 BU primitives (gets 2 BU back each, 4 BU total, fine), but she cannot mirror a 12 BU primitive and bank a 6 BU refund. The cap stops her.",
    ],
    table_intro: "Starting budgets and mirror refund caps, by level range:",
    note: "These are a starting suggestion. The system is a heuristic. Discuss with your table. The cap exists to keep mirror a tradeoff, not a cheat code.",
  },
  {
    n: "05",
    title: "What you can mirror",
    sub: "most primitives mirror cleanly. some do not.",
    body: [
      "Anything with a number attached to it. Attributes, damage dice, range bands, status infliction, defensive save bonuses. If the primitive normally says +X, the mirror says -X.",
      "Some primitives do not mirror. Anything where the inverse is meaningless or breaks the fiction. Status infliction usually mirrors fine (you propose conditions at the table anyway). Verb tier and domain tier do not mirror in the traditional sense. Tiering is a tiering thing.",
      "If you are not sure, propose the mirror at the table. The table decides. The mechanic is a heuristic, remember.",
    ],
    mirrors_vs: [
      {
        kind: "mirrors cleanly",
        examples: [
          "Physical Edge +4 (6 BU) → mirrored: -4 Physical, 3 BU refund",
          "Long Range (4 BU) → mirrored: short range disadvantage, 2 BU refund",
          "Status Infliction (5 BU) → mirrored: condition susceptibility, 2 BU refund",
        ],
      },
      {
        kind: "table discretion",
        examples: [
          "Verb tier upgrades (you cannot really negative-tier a verb)",
          "Domain tier (flipping your domain upside down is a different character)",
          "Cultural or flavour primitives that do not have a clear inverse",
        ],
      },
    ],
  },
  {
    n: "06",
    title: "When you slot it",
    sub: "you own both directions, decide at the table",
    body: [
      "This is the part people get wrong. Once a primitive is in your inventory, you own it. Whether you bought it normally or mirrored it, you own it the same way. When you slot it into a capability or effect, you choose the direction at the table.",
      "Lyra mirrored Physical Edge. Her capability card reads -4 Physical. But if at the table she needs to be strong for one specific moment, she pulls the unmirrored version out. The capability itself, when she writes it, can hold either direction. The choice happens when she uses it.",
      "This is the part that makes mirror interesting, not punitive. You are not locked into the disadvantage forever. You are paying the disadvantage as a baseline, and getting the option back when the fiction calls for it.",
    ],
    pullquote: "Mirror is not a curse. It is a budget mechanic that costs you nothing at acquisition and gives you back full flexibility at the table.",
  },
  {
    n: "07",
    title: "Lyra, end to end",
    sub: "a worked character with two mirrors",
    body: [
      "Lyra is a void-walker hiding from the salt-mines company. Let us build her at Level 1 with two mirrors and see how the budget closes.",
    ],
    lyra: [
      {
        label: "Base",
        lines: [
          "Tier I (Level 1)            25 BU",
          "Proficient attribute        -10 BU",
          "10 free attribute points   (distributed into Magic +4, Mental +3, Physical +3)",
        ],
      },
      {
        label: "What she buys",
        lines: [
          "Verb Tier II (Hit, Move, Control, Heal)         -8 BU",
          "Domain Tier III (Space)                        -12 BU",
          "Damage 1d8 Magical                             -5 BU",
          "Range: Close                                    -2 BU",
          "Single Target                                  included",
          "Mirror: Physical Edge +4 (normally 6 BU)        -0 BU  +3 refund",
          "Mirror: Save Training (normally 10 BU)         -0 BU  +4 refund",
          "                                                 ─────",
          "running total                                    -9 BU used",
          "                                                 +7 BU debt collected",
          "                                                 ─────",
          "                                                  23 BU left to spend",
        ],
      },
      {
        label: "What she carries",
        lines: [
          "attributes    · Physical +3, Mental +3, Magical +4",
          "proficient    · Magical (PB +2 at Level 1)",
          "verb tier     · Tier II (Hit, Move, Control, Heal)",
          "domain        · Space Tier III",
          "damage        · 1d8 Magical",
          "range         · Close",
          "targeting     · Single + AoE Cone (bought with debt)",
          "mirrors       · Physical Edge -4 · Save Training -2",
          "remaining     · 18 BU unspent (rolled into gear or saved)",
        ],
      },
      {
        label: "At the table",
        lines: [
          "She opens a wormhole to escape the sentry. Scale: Self (1).",
          "Impact: Tactical (2). Complexity: Space-Tier (2). Raw 5, Strain 3.",
          "GM names a 3 Vitality cost. She accepts. Roll d20 + Magical (+4)",
          "+ PB (+2) + verb bonus vs target's 5 + Mental + PB. Hit or miss,",
          "she paid 3 Vitality up front.",
          "",
          "Next turn she needs to haul the wounded miner out. She reaches",
          "for Physical Edge. The capability card reads -4. But this is",
          "the moment. She slots the unmirrored direction. One-time",
          "override. The cost was already paid at character creation.",
        ],
      },
    ],
  },
  {
    n: "08",
    title: "Heuristics, not rules",
    sub: "the mirror is yours to bend",
    body: [
      "The mirror refund percentages and the per-range caps are a starting suggestion. The whole system is a heuristic. Your table will want different numbers. Some tables will say: mirror refund is 100% of cost, no cap, the disadvantages balance themselves. Other tables will say: 25% refund, hard cap at 3 BU per character, ever.",
      "There is no wrong answer. The mechanic exists because players wanted a way to build weirder characters without breaking the budget. Tune it until your table is having fun.",
    ],
    signoff: true,
  },
] as const;

export default function CharacterPage() {
  return (
    <div className="sw-home relative mx-auto w-full max-w-[1400px] px-4 pb-24 pt-16 sm:px-6 sm:pt-16 lg:px-10 lg:pt-16">
      <PublicNav />

      {/* Top marginalia bar — same pattern as /start and /about */}
      <div className="sw-marginalia sw-marginalia--top mb-10 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-border pb-3 text-[10px] uppercase tracking-[0.22em] text-muted-foreground sm:text-xs">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
          <Link href="/" className="font-display text-foreground hover:text-primary">
            Sword<span className="text-primary">·</span>Weave
          </Link>
          <span>Character creation</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
          <span aria-hidden className="text-primary/70">
            §00–§80 · six decisions
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

      {/* Hero */}
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
            <span className="block">Take the hit,</span>
            <span className="block">
              keep the <span className="sw-headline__under">budget</span>,
            </span>
            <span className="block text-muted-foreground">keep the option.</span>
          </h1>

          <p className="mt-6 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
            Six decisions to a character. A mirror that pays nothing, costs
            nothing, and gives you back a permanent budget refund in exchange
            for a permanent disadvantage. By the end of this page you will
            have built one character and seen the mirror work end to end.
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

      {/* Inline mirror mechanic panel — at-a-glance summary */}
      <section className="sw-section relative border-y border-border bg-card/40 py-12 sm:py-16 lg:py-20">
        <SectionHeading
          index="§00"
          eyebrow="At a glance"
          title="The mirror in one read"
          deck="Below is the whole mechanic on one panel. Skim it now, then walk the eight sections below for the worked example and the level caps."
        />

        <div className="mt-10 grid gap-px overflow-hidden border border-border bg-border sm:grid-cols-3">
          <div className="flex flex-col gap-2 bg-card p-5 sm:p-6">
            <span className="font-display text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              What you pay
            </span>
            <p className="font-display text-2xl font-bold uppercase leading-none">
              0 BU
            </p>
            <p className="text-xs text-muted-foreground sm:text-sm">
              The primitive enters your inventory for free. You do not spend the original X BU at all.
            </p>
          </div>
          <div className="flex flex-col gap-2 bg-card p-5 sm:p-6">
            <span className="font-display text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              What you accept
            </span>
            <p className="font-display text-2xl font-bold uppercase leading-none">
              -Y effect
            </p>
            <p className="text-xs text-muted-foreground sm:text-sm">
              The primitive reads as the inverse of its normal effect on your sheet. Permanent.
            </p>
          </div>
          <div className="flex flex-col gap-2 bg-card p-5 sm:p-6">
            <span className="font-display text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              What you get back
            </span>
            <p className="font-display text-2xl font-bold uppercase leading-none">
              Partial X BU
            </p>
            <p className="text-xs text-muted-foreground sm:text-sm">
              GM credits a portion of the original X BU into your budget. Capped per level range.
            </p>
          </div>
        </div>

        <p className="mt-6 max-w-2xl text-xs leading-6 text-muted-foreground sm:text-sm sm:leading-7">
          And the part people miss: once the primitive is in your inventory,
          you own both directions. The capability or effect you write can slot
          either one. The choice happens at the table, not on the sheet.
        </p>
      </section>

      {/* The eight sections */}
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
                          <p className="mt-1 text-sm leading-6 text-foreground sm:text-base sm:leading-7">
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

                {/* Single example card (section 2) */}
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

                {/* Mirror vs table discretion (section 5) */}
                {"mirrors_vs" in section && section.mirrors_vs && (
                  <div className="mt-7 grid gap-px overflow-hidden border border-border bg-border sm:grid-cols-2">
                    {section.mirrors_vs.map((col) => (
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

                {/* Level table (section 4) */}
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
                              Range
                            </th>
                            <th className="px-4 py-3 font-display text-[10px] uppercase tracking-[0.22em] text-primary">
                              Tier
                            </th>
                            <th className="px-4 py-3 font-display text-[10px] uppercase tracking-[0.22em] text-primary">
                              Starting
                            </th>
                            <th className="px-4 py-3 font-display text-[10px] uppercase tracking-[0.22em] text-primary">
                              Mirror cap
                            </th>
                            <th className="hidden px-4 py-3 font-display text-[10px] uppercase tracking-[0.22em] text-muted-foreground sm:table-cell">
                              Note
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {LEVEL_TABLE.map((row) => (
                            <tr
                              key={row.range}
                              className="border-b border-border/50 last:border-0"
                            >
                              <td className="px-4 py-3 font-display text-sm font-bold uppercase sm:text-base">
                                {row.range}
                              </td>
                              <td className="px-4 py-3 font-display text-sm uppercase tracking-tight text-muted-foreground sm:text-base">
                                {row.tier}
                              </td>
                              <td className="px-4 py-3 font-display text-base sm:text-lg">
                                {row.starting} BU
                              </td>
                              <td className="px-4 py-3 font-display text-base text-primary sm:text-lg">
                                +{row.cap} BU
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

                {/* Lyra worked example (section 7) */}
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

                {/* Signoff (section 8) */}
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
                Eight steps from intent to first roll. No database, no account,
                no menu of classes. Read it like a recipe.
              </p>
            </div>
            <ArrowRight className="size-5 shrink-0 text-primary transition-transform group-hover:translate-x-1" />
          </Link>

          <Link
            href="/codex?kind=primitive"
            className="sw-codex-card group flex items-baseline justify-between gap-4 border border-border bg-card p-5 transition-colors hover:border-primary/60 sm:p-6"
          >
            <div className="min-w-0">
              <p className="font-display text-[10px] uppercase tracking-[0.22em] text-primary">
                Ready to buy
              </p>
              <p className="mt-1 font-display text-2xl font-bold uppercase leading-none sm:text-3xl">
                Browse primitives
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                118 published primitives in the codex. See what you can
                mirror, what you can buy, and what someone else already
                forked.
              </p>
            </div>
            <ArrowRight className="size-5 shrink-0 text-primary transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </section>
    </div>
  );
}

// =============================================================================
// SectionHeading — identical to /start for consistency.
// =============================================================================
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
