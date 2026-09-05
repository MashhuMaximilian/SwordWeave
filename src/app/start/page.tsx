import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import type { Metadata } from "next";
import { CompositionDiagram } from "@/components/home/composition-diagram";

// =============================================================================
// /start — "Know who they are, then build everything they can do."
//
// Eight-step narrative walkthrough of the SwordWeave system. Server component,
// no client JS, no database. Pure prose + typeset spec cards. Same avant-garde
// editorial language as the homepage.
//
// Sections:
//   §00 — Know who they are        (no mechanics, just intent)
//   §10 — Pick the verbs           (verb tiers, BU cost, free-use)
//   §20 — Pick the domains         (domain tiers, narrative permission)
//   §30 — Pick the outputs         (damage dice, status infliction)
//   §40 — Pick the geometry        (range, targeting)
//   §50 — Write the preset cards   (capabilities = compiled lists)
//   §60 — When you play it         (3 Dials → Strain → Cost → d20)
//   §70 — What you don't write on the sheet (playtime decisions)
//
// Mobile behavior: every section collapses to single column. The diagram
// scales fluidly.
// =============================================================================

export const metadata: Metadata = {
  title: "Start · SwordWeave",
  description:
    "Eight steps from intent to first roll. Know who you are, then build everything they can do.",
};

const STEPS = [
  {
    n: "01",
    title: "Know who they are",
    sub: "no mechanics yet",
    body: [
      "Who are they? What do they want? What can't they live with? Write one paragraph about them in plain language. No dice, no math, no menu of classes.",
      "The system is built from the character outward. The fiction comes first. Everything you build from here on exists because this paragraph said so.",
    ],
    example: {
      label: "Draft",
      lines: [
        "Lyra grew up in the salt mines, learned to fold space",
        "to get home before her shift ended. She left because",
        "the company found out and started selling what she",
        "could do. Now she hides, mostly. When she can't,",
        "she burns first and explains never.",
      ],
    },
  },
  {
    n: "02",
    title: "Pick the verbs you'll need",
    sub: "you buy verb tiers with BU",
    body: [
      "A verb is the shape of an action: Hit, Move, Control, Heal. You don't buy individual verbs. You buy the tier.",
      "Tier I (4 BU) covers basic action shapes. Tier II (8 BU) opens more advanced shapes. Tier III (12 BU) for major feats. Tier IV (16 BU) for reality-warping.",
      "Once you own a tier, you can use any verb in it. Custom verbs you invent at the table go into whichever tier the GM agrees fits. The tier travels with you.",
    ],
    example: {
      label: "Lyra buys",
      lines: ["TIER II  · 8 BU  · Hit, Move, Control", "TIER III · 12 BU · Heal, plus bigger shapes"],
    },
  },
  {
    n: "03",
    title: "Pick your domains",
    sub: "you buy one domain tier with BU",
    body: [
      "Domains are the medium you route intent through. Fire, Gravity, Space, Mind, Time, Life, Light, Mind, and a few dozen more.",
      "Tier I (4 BU) covers basic elements. Tier IV (16 BU) covers advanced conceptual systems. Buy once. Use freely. A domain is not slotted into a capability; it's narrative permission to manipulate that force whenever you want.",
      "Why one tier? Because the level of a domain determines what you can do with it, not how many you own. Owning Space Tier IV means you can warp local coordinate space any way you can describe it.",
    ],
    example: {
      label: "Lyra buys",
      lines: ["SPACE TIER IV · 16 BU · warp local coordinates"],
    },
  },
  {
    n: "04",
    title: "Pick your outputs",
    sub: "damage dice and status infliction",
    body: [
      "Outputs are what happens when the verb lands. Damage dice: 1d4, 1d6, 1d8, 1d10, 1d12, 1d20. Each die has a source type (Physical, Magical, Psychic) that you pick when you buy it.",
      "Status infliction is also an output primitive. Buying it gives you the right to propose a status condition at the table.",
      "Status conditions are not predefined. You say 'I'm stunning them' or 'I'm knocking them prone.' The table decides what those words mean in this scene, right now. Prone from a tree-fall is different from prone after your legs get cut. The mechanic is the servant of the fiction.",
    ],
    example: {
      label: "Lyra buys",
      lines: ["DAMAGE 1D8 PHYSICAL · 5 BU", "DAMAGE 1D10 MAGICAL  · 7 BU", "STATUS INFLICTION · 5 BU"],
    },
  },
  {
    n: "05",
    title: "Pick your geometry",
    sub: "range and targeting",
    body: [
      "Geometry is how far and how wide the intent travels. Range gates: Touch, Close, Near, Far, Very Far, Extreme, World. Targeting: single, multi-target, AoE cone, line, sphere.",
      "Buy the geometry you actually need. You can always upgrade later when the budget allows. There's no rule that says a fireball has to be a sphere. There is a rule that says it has to hit who you aimed it at.",
    ],
    example: {
      label: "Lyra buys",
      lines: ["CLOSE RANGE · 2 BU", "SINGLE TARGET · included", "AoE CONE · 5 BU (for emergencies)"],
    },
  },
  {
    n: "06",
    title: "Write the preset cards",
    sub: "capabilities = compiled lists, free to make",
    body: [
      "Now compose. Pick a verb. Route it through one or more of your owned domains. Attach your outputs and geometry. Write the result on your sheet.",
      "Writing a preset is free because you already paid for the ingredients. Capabilities can also slot effects (the maintained states; more on those below).",
      "Advanced players often skip capabilities entirely. They buy primitives and improvise at the table. The preset card is just a quick-access template, a favourite recipe. You can always reach into your inventory and weld primitives into something you didn't write down.",
    ],
    example: {
      label: "Lyra's Burning Strike",
      lines: [
        "verb   · Hit",
        "domain · Fire",
        "output · 1d8 Magical damage",
        "geom   · Close",
        "",
        "= HIT + FIRE + 1D8 + CLOSE",
      ],
    },
  },
  {
    n: "07",
    title: "When you play it",
    sub: "the 3 dials, strain, cost, the d20",
    body: [
      "At the table, your GM reads three dials against your intent:",
    ],
    dials: [
      { name: "Scale", range: "Self → Scene-Wide", note: "how big is it?" },
      { name: "Impact", range: "Minor → Reality Pressure", note: "how hard does it hit?" },
      { name: "Complexity", range: "Simple → Reality-Tier", note: "how weird is it?" },
    ],
    after_dials: [
      "Sum the three dials. Translate the raw score through the Strain Ledger. The GM names an upfront cost in Vitality. You accept, negotiate smaller, or abort. That moment is the Pivot Point.",
      "If you accept, you pay the cost and roll. The entire game uses one formula: d20 + attribute + Proficiency Bonus (if trained) + capability modifier vs the Defensive DC of your target (5 + relevant attribute + PB + bonuses).",
      "Strain 0 to 2 is Low Pressure. Strain 3 is Moderate. Strain 4 to 5 is Heavy or Extreme. Strain 6 is Reality-Breaking. The cost grows with the strain. Fail or succeed, you paid.",
    ],
  },
  {
    n: "08",
    title: "What you don't write on the sheet",
    sub: "playtime decisions, not sheet-state",
    body: [
      "Scaling, Strain, Cost, the 3 Dials, the meaning of a status condition. None of that lives on the character sheet.",
      "The sheet captures what you own (primitives) and your favourite recipes (capabilities, effects). Everything else is the table's live conversation, decided in the fiction, in the moment, by the people in the room.",
      "That's the engine. The rest is your character, your table, your story. You bought the puzzle pieces. How you put them together is up to you.",
    ],
    signoff: true,
  },
] as const;

export default function StartPage() {
  return (
    <div className="sw-home relative mx-auto w-full max-w-[1400px] px-4 pb-24 pt-4 sm:px-6 sm:pt-6 lg:px-10 lg:pt-8">
      {/* Top marginalia bar — same as homepage */}
      <div className="sw-marginalia sw-marginalia--top mb-10 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-border pb-3 text-[10px] uppercase tracking-[0.22em] text-muted-foreground sm:text-xs">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
          <Link href="/" className="font-display text-foreground hover:text-primary">
            Sword<span className="text-primary">·</span>Weave
          </Link>
          <span>The walkthrough</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
          <span aria-hidden className="text-primary/70">
            §00–§80 · eight steps
          </span>
          <Link href="/about" className="hover:text-foreground">
            About
          </Link>
          <Link href="/codex" className="inline-flex items-center gap-1 hover:text-foreground">
            Open the codex
            <ArrowUpRight className="size-3" />
          </Link>
        </div>
      </div>

      {/* Hero — short, in keeping with the rest of the site */}
      <section className="sw-hero relative grid gap-6 pb-12 sm:pb-16 lg:grid-cols-[64px_1fr] lg:gap-10 lg:pb-20">
        <div aria-hidden className="sw-running-head hidden lg:block">
          <span>SW · START · VIII STEPS</span>
        </div>

        <div className="min-w-0">
          <div className="mb-3 inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.28em] text-primary lg:hidden">
            <span className="size-1.5 rounded-full bg-primary" />
            The walkthrough
          </div>

          <h1 className="font-display text-[clamp(2.25rem,7vw,5.5rem)] font-bold uppercase leading-[0.9] tracking-tight">
            <span className="block">Know who they are,</span>
            <span className="block">
              then build <span className="sw-headline__weave">everything</span>
            </span>
            <span className="block text-muted-foreground">they can do.</span>
          </h1>

          <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
            Eight steps from intent to first roll. No database, no account,
            no menu of classes. Read it like a recipe. Stop when you have
            enough to start playing.
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link
              href="#step-1"
              className="sw-cta-primary inline-flex h-11 items-center gap-2 bg-primary px-5 text-sm font-bold uppercase tracking-[0.12em] text-primary-foreground"
            >
              Start at §01
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/"
              className="sw-cta-ghost inline-flex h-11 items-center gap-2 border border-border bg-card px-5 text-sm font-bold uppercase tracking-[0.12em] text-foreground hover:border-primary/60 hover:text-primary"
            >
              Back to homepage
            </Link>
          </div>
        </div>
      </section>

      {/* Inline diagram — same SVG component as the homepage */}
      <section className="sw-section relative border-y border-border bg-card/40 py-12 sm:py-16 lg:py-20">
        <SectionHeading
          index="§00"
          eyebrow="The shape of it"
          title="What you're about to build"
          deck="Eight steps. The first five are buying puzzle pieces. The sixth is writing them down. The seventh is what happens when you use one. The eighth is what stays off the page. The whole thing is a short walk, not a manual."
        />
        <div className="mt-10 sm:mt-14">
          <CompositionDiagram />
        </div>
      </section>

      {/* The eight steps */}
      <section className="sw-section py-14 sm:py-20 lg:py-24">
        <ol className="space-y-16 sm:space-y-20 lg:space-y-24">
          {STEPS.map((step, i) => (
            <li
              key={step.n}
              id={`step-${i + 1}`}
              className="grid scroll-mt-24 gap-6 border-t border-border pt-10 sm:gap-8 lg:grid-cols-[120px_1fr] lg:gap-12"
            >
              <header className="flex flex-row items-baseline gap-3 lg:flex-col lg:items-start lg:gap-1">
                <span className="font-display text-4xl font-bold leading-none text-primary sm:text-5xl">
                  {step.n}
                </span>
                <span className="font-display text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                  §{i}0
                </span>
              </header>

              <div className="min-w-0">
                <h2 className="font-display text-3xl font-bold uppercase leading-[0.95] tracking-tight sm:text-4xl lg:text-5xl">
                  {step.title}
                </h2>
                <p className="mt-2 font-display text-xs uppercase tracking-[0.22em] text-primary sm:text-sm">
                  {step.sub}
                </p>

                <div className="mt-5 space-y-4 text-sm leading-7 text-foreground sm:text-base sm:leading-8">
                  {"body" in step &&
                    step.body.map((para, j) => (
                      <p key={j}>{para}</p>
                    ))}
                </div>

                {/* Optional dials callout (step 7 only) */}
                {"dials" in step && step.dials && (
                  <div className="mt-6 grid gap-3 border border-border bg-card p-5 sm:grid-cols-3 sm:gap-4">
                    {step.dials.map((dial) => (
                      <div key={dial.name} className="border-l-2 border-primary pl-3">
                        <p className="font-display text-[10px] uppercase tracking-[0.22em] text-primary">
                          {dial.name}
                        </p>
                        <p className="mt-1 font-display text-base uppercase tracking-tight">
                          {dial.range}
                        </p>
                        <p className="mt-1 text-xs italic text-muted-foreground">
                          {dial.note}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {"after_dials" in step && step.after_dials && (
                  <div className="mt-5 space-y-4 text-sm leading-7 text-foreground sm:text-base sm:leading-8">
                    {step.after_dials.map((para, j) => (
                      <p key={j}>{para}</p>
                    ))}
                  </div>
                )}

                {/* Optional example card (not step 7) */}
                {"example" in step && step.example && (
                  <figure className="sw-recipe mt-6 border border-border bg-card p-5 sm:p-6">
                    <figcaption className="font-display text-[10px] uppercase tracking-[0.22em] text-primary">
                      {step.example.label}
                    </figcaption>
                    <pre className="mt-3 whitespace-pre-wrap font-display text-xs leading-[1.7] text-foreground sm:text-sm">
                      {step.example.lines.join("\n")}
                    </pre>
                  </figure>
                )}

                {/* Signoff (step 8) */}
                {"signoff" in step && step.signoff && (
                  <p className="sw-tenet__signoff mt-8 max-w-2xl border-l-2 border-primary pl-4 font-display text-base uppercase italic text-muted-foreground sm:text-lg">
                    It is a game we play in our minds with friends. Do whatever you want.
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
            href="/codex"
            className="sw-codex-card group flex items-baseline justify-between gap-4 border border-border bg-card p-5 transition-colors hover:border-primary/60 sm:p-6"
          >
            <div className="min-w-0">
              <p className="font-display text-[10px] uppercase tracking-[0.22em] text-primary">
                After the walkthrough
              </p>
              <p className="mt-1 font-display text-2xl font-bold uppercase leading-none sm:text-3xl">
                Browse the codex
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Find the base primitives, community capabilities, hand-tuned
                heritages. Fork anything. Publish what you love.
              </p>
            </div>
            <ArrowRight className="size-5 shrink-0 text-primary transition-transform group-hover:translate-x-1" />
          </Link>

          <Link
            href="/atelier?build=primitive"
            className="sw-codex-card group flex items-baseline justify-between gap-4 border border-border bg-card p-5 transition-colors hover:border-primary/60 sm:p-6"
          >
            <div className="min-w-0">
              <p className="font-display text-[10px] uppercase tracking-[0.22em] text-primary">
                Ready to build
              </p>
              <p className="mt-1 font-display text-2xl font-bold uppercase leading-none sm:text-3xl">
                Open the atelier
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Buy your first primitive, write your first capability, slot
                it into a heritage. The atelier is where the puzzle pieces
                become a character.
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
// SectionHeading — identical to the homepage helper for consistency.
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
