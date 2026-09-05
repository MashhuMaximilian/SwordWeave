import Link from "next/link";
import Image from "next/image";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { auth } from "@clerk/nextjs/server";
import { HomepageAuth } from "@/components/layout/homepage-auth";
import { PublicNav } from "@/components/home/public-nav";
import { CompositionDiagram } from "@/components/home/composition-diagram";

// =============================================================================
// SwordWeave homepage — "The Translation Engine"
//
// Editorial / manuscript-meets-instrument aesthetic. Server component for fast
// first paint + SEO. Auth-aware CTAs are delegated to a small client island
// (HomepageAuth). Color tokens + fonts (Teko / Magra / teal / forge) come from
// globals.css and must stay in sync.
//
// Sections, in document order:
//   00. Top marginalia bar — running header, version stamp, "open the codex" link
//   01. Hero — vertical running head + colossal headline + deck + CTAs
//   02. System diagram — typographic notation of the BU flow
//   03. The five layers — specimen cards for Primitives, Effects, Capabilities,
//       Heritages, Items
//   04. Fork + version — "Anything can be forked. Everything is versioned."
//   05. The eight core tenets — editorial column, oversized numerals
//   06. Codex teaser — primitive / capability strip + entry CTA
//   07. Bottom marquee — recipe strip scrolling recipes
//
// Mobile behavior: every section collapses to single column; the vertical
// running head flips to a horizontal eyebrow; the diagram becomes vertical;
// the version timeline collapses to inline tokens.
// =============================================================================

// Recipe strips used in the bottom marquee and the diagram annotations.
const RECIPE_STRIPS = [
  "DAMAGE + FIRE → SEARING BURST",
  "MOVE + SPACE → WORMHOLE",
  "HEAL + COMMUNION → VITAL WELL",
  "CONTROL + MIND → WHISPERED GEAS",
  "DAMAGE + ICE → GLACIAL FANGS",
  "MOVE + GRAVITY → WEIGHT OF NAMES",
  "CONTROL + TIME → DEFERRED BLOW",
  "HEAL + LIFE → SECOND BREATH",
] as const;

const LAYERS = [
  {
    n: "01",
    title: "Primitives",
    bu: "BU · atomic",
    body:
      "The only thing you actually buy. Atomic puzzle pieces: verb tiers (the action shape), domain tiers (the medium, free-use once owned), output dice and status infliction, range and targeting geometry, and your stat baseline. Once owned, a primitive is yours forever and fits into anything you compose.",
    example: "FIRE · VERB TIER I · 1D8 DAMAGE · CLOSE",
  },
  {
    n: "02",
    title: "Capabilities",
    bu: "no BU",
    body:
      "Compiled lists of primitives. A pre-written cheat-sheet for an action: pick a verb, route it through one or more of your domains, attach your outputs and geometry. Writing one is free because you already paid for the ingredients. Advanced players often skip capabilities entirely and improvise from primitives at the table.",
    example: "BURNING STRIKE · HIT + FIRE + 2D8 + CLOSE",
  },
  {
    n: "03",
    title: "Effects",
    bu: "no BU",
    body:
      "Compiled lists of primitives with a duration. Maintained states, a localized blizzard, a kinetic barrier, a summoned wisp. Effects slot INTO capabilities and items. Heritages do not slot effects directly, only via capabilities. Status conditions (Stun, Prone, Blind) are not predefined; the table decides what they mean per fiction.",
    example: "BLIZZARD · PRIM + SHORT + UPKEEP 1",
  },
  {
    n: "04",
    title: "Heritages",
    bu: "no direct BU",
    body:
      "Where you came from. Lineage (biology), Upbringing (culture), Manifest (vocation). Three flavors of the same slot. Story reasons for why you own your primitives and capabilities (wings because you are an elf, or because your patron gave them, or because of a quest reward). No effects slot here directly, only via the capabilities you bring.",
    example: "ELF · ACOLYTE · PYROMANCER",
  },
  {
    n: "05",
    title: "Items",
    bu: "BU on the item",
    body:
      "Capability carriers. Slots accept primitives, capabilities, AND effects (the only slot that takes all three). A magic sword might slot a Damage primitive plus the Burning capability. An attuned ring might slot a maintained Effect. You pay BU for the item shell, then fill the inside slots with things you already own for free.",
    example: "BURNING BLADE · 8 BU + FILLED SLOTS",
  },
] as const;

const TENETS = [
  {
    n: "01",
    head: "Consequences are negotiated at the table.",
    body: "There are no spell slots. You have Vitality. When you push too hard, the world pushes back, and the GM names the cost before you roll. Accept, negotiate smaller, or abort. That moment is the Pivot Point.",
  },
  {
    n: "02",
    head: "A framework, not a spreadsheet.",
    body: "Heuristic, not arithmetic. The numbers exist to translate story into stakes, never to halt the game for a rules argument.",
  },
  {
    n: "03",
    head: "Collaborative storytelling.",
    body: "Everyone at the table, players and DM, are co-authors. The dice resolve uncertainty. The fiction resolves meaning. The GM is not a computer. The GM is a Translation Engine.",
  },
  {
    n: "04",
    head: "Rule of cool is king.",
    body: "Cool things are rarely easy and never free. Wild feats are allowed, they spike the Strain, drain Vitality, and warp the local scene. Let the player pull the rubber band as hard as they want, but make the snap-back visible.",
  },
  {
    n: "05",
    head: "It all happens in our heads anyway.",
    body: "Trust the table. If a rule blocks a brilliant dramatic moment, rewrite the rule on the spot. The mechanic is the servant of the fiction, never its master.",
  },
  {
    n: "06",
    head: "Everything is a guideline.",
    body: "Bend the system to your world and your playstyle, not the other way around. Fork anything. Version everything. Publish what you love. Discard what you do not.",
  },
  {
    n: "07",
    head: "Balance is a truce, not a law.",
    body: "An easy encounter can TPK on a hot streak of dice. All the engine can do is balance party BU against adversary BU. The rest is the table's shared judgement.",
  },
  {
    n: "08",
    head: "Build what you intend to play.",
    body: "Start with the character in your head. Make the primitives, capabilities, effects, and heritages that fit the fiction you want to tell. It is almost always faster than browsing the library for someone else's perfect fit.",
  },
] as const;

export default async function HomePage() {
  const { userId } = await auth();
  return (
    <div className="sw-home relative mx-auto w-full max-w-[1400px] px-4 pb-24 pt-16 sm:px-6 sm:pt-16 lg:px-10 lg:pt-16">
      <PublicNav />
      {/* ────────────────────────────────────────────────────────────────
          00. Top marginalia bar — running header, edition stamp, codex link
          ──────────────────────────────────────────────────────────────── */}
      <div className="sw-marginalia sw-marginalia--top mb-10 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-border pb-3 text-[10px] uppercase tracking-[0.22em] text-muted-foreground sm:text-xs">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
          <span className="font-display text-foreground">
            Sword<span className="text-primary">·</span>Weave
          </span>
          <span className="hidden sm:inline">The Translation Engine</span>
          <span className="hidden md:inline">
            A modular engine for collaborative storytelling
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
          <span aria-hidden className="text-primary/70">
            ED. I · v.1
          </span>
          <Link
            href="/codex"
            className="inline-flex items-center gap-1 hover:text-foreground"
          >
            Open the codex
            <ArrowUpRight className="size-3" />
          </Link>
          <Link
            href="/attributions"
            className="hidden hover:text-foreground sm:inline"
          >
            Attributions
          </Link>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────────────
          01. Hero — vertical running head + colossal headline + CTAs
          ──────────────────────────────────────────────────────────────── */}
      <section className="sw-hero relative grid gap-8 pb-16 sm:pb-20 lg:grid-cols-[64px_1fr] lg:gap-10 lg:pb-28">
        {/* Vertical running head — desktop only */}
        <div
          aria-hidden
          className="sw-running-head hidden lg:block"
        >
          <span>SW · ENGINE · I · MMXXVI</span>
        </div>

        <div className="min-w-0">
          {/* Mobile horizontal eyebrow */}
          <div className="mb-3 inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.28em] text-primary lg:hidden">
            <span className="size-1.5 rounded-full bg-primary" />
            The Translation Engine
          </div>

          {/* Brand mark + status row */}
          <div className="mb-4 flex flex-wrap items-end gap-4">
            <Image
              src="/logo-light.png"
              alt=""
              width={64}
              height={78}
              className="block h-auto w-12 dark:hidden"
              priority
            />
            <Image
              src="/logo-dark.png"
              alt=""
              width={64}
              height={78}
              className="hidden h-auto w-12 dark:block"
              priority
            />
            <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-muted-foreground sm:text-xs">
              <span className="rounded-sm border border-primary/40 bg-primary/10 px-2 py-1 font-bold text-primary">
                Engine · live
              </span>
              <span className="hidden sm:inline">
                · No classes · No spell slots · Rule of cool is king
              </span>
            </div>
          </div>

          {/* The headline */}
          <h1 className="sw-headline font-display text-[clamp(2.75rem,9vw,7.5rem)] font-bold uppercase leading-[0.86] tracking-tight">
            <span className="block">A game</span>
            <span className="block">
              you <span className="sw-headline__weave">weave</span>
            </span>
            <span className="block text-muted-foreground">
              from <span className="text-foreground">atomic</span> intent.
            </span>
          </h1>

          {/* Deck — the manifesto */}
          <p className="mt-6 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
            SwordWeave is not a rulebook. It is a construction language for
            collaborative storytelling. You buy atomic primitives, assemble
            them into capabilities and effects, slot them into heritages and
            items, and tell the story you came to tell. At the table, in your
            head, with the friends already in the room.
          </p>

          {/* CTAs */}
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/atelier?build=primitive"
              className="sw-cta-primary group inline-flex h-11 items-center gap-2 bg-primary px-5 text-sm font-bold uppercase tracking-[0.12em] text-primary-foreground"
            >
              Open the Atelier
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              href="/codex"
              className="sw-cta-ghost inline-flex h-11 items-center gap-2 border border-border bg-card px-5 text-sm font-bold uppercase tracking-[0.12em] text-foreground hover:border-primary/60 hover:text-primary"
            >
              Browse the Codex
            </Link>
            <Link
              href="/atelier?build=primitive&intent=primer"
              className="hidden text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline sm:inline"
            >
              Read the 5-minute primer →
            </Link>
          </div>

          {/* Auth-aware CTAs (signed-out only) */}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <HomepageAuth signedIn={!!userId} />
          </div>

          {/* Marginalia annotations — typographic asides */}
          <div className="sw-marginalia-grid mt-10 grid grid-cols-1 gap-3 text-[11px] uppercase tracking-[0.18em] text-muted-foreground sm:grid-cols-2 sm:text-xs lg:grid-cols-4">
            <span className="flex items-baseline gap-2">
              <span className="text-primary">§00</span> Collaborative · not competitive
            </span>
            <span className="flex items-baseline gap-2">
              <span className="text-primary">§01</span> Buy primitives · everything else is free
            </span>
            <span className="flex items-baseline gap-2">
              <span className="text-primary">§02</span> Fork anything · version everything
            </span>
            <span className="flex items-baseline gap-2">
              <span className="text-primary">§03</span> The DM is a translation engine
            </span>
          </div>
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────────────
          02. System diagram — the composition taxonomy (inline SVG)
          ──────────────────────────────────────────────────────────────── */}
      <section className="sw-section relative border-y border-border bg-card/40 py-12 sm:py-16 lg:py-20">
        <SectionHeading
          index="§10"
          eyebrow="The notation"
          title="How the engine composes"
          deck="Primitives are the only thing you actually buy with BU. Everything else is free: compiled lists (capabilities, effects) and composition slots (heritages, items) all reference the primitives you already own. Status conditions are not predefined, the table decides what they mean in the fiction."
        />

        <div className="mt-10 sm:mt-14">
          <CompositionDiagram />
        </div>

        {/* Worked example callout */}
        <div className="sw-recipe mt-10 flex flex-col gap-4 border-t border-border pt-6 sm:mt-14 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.22em] text-primary">
              Worked example · Burning Strike
            </p>
            <p className="mt-1 font-display text-lg uppercase leading-tight sm:text-xl">
              Hit + Fire + 1d8 + Close →{" "}
              <span className="text-primary">Burning Strike</span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
              You buy Verb Tier I, Fire Domain, 1d8 output, Close range. One
              capability writes itself. Use the same primitives in any other
              capability, effect, heritage, or item, forever.
            </p>
          </div>
          <Link
            href="/atelier?build=primitive"
            className="sw-cta-primary inline-flex h-10 w-fit items-center gap-2 bg-primary px-4 text-xs font-bold uppercase tracking-[0.14em] text-primary-foreground"
          >
            Try it
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────────────
          03. The five layers — specimen cards
          ──────────────────────────────────────────────────────────────── */}
      <section className="sw-section py-14 sm:py-20 lg:py-24">
        <SectionHeading
          index="§20"
          eyebrow="Specimens"
          title="The five layers"
          deck="Each layer is a different scale of composition. Only the bottom one, the primitive, costs Build Units. Everything above is structure on top of the primitives you already own."
        />

        <div className="mt-10 grid gap-px overflow-hidden border border-border bg-border sm:mt-14 lg:grid-cols-2 xl:grid-cols-5">
          {LAYERS.map((layer) => (
            <article
              key={layer.n}
              className="sw-specimen group relative flex flex-col gap-3 bg-card p-5 transition-colors hover:bg-background sm:p-6"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-display text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                  Layer {layer.n}
                </span>
                <span className="font-display text-[10px] uppercase tracking-[0.22em] text-primary">
                  {layer.bu}
                </span>
              </div>
              <h3 className="font-display text-2xl font-bold uppercase leading-none sm:text-3xl">
                {layer.title}
              </h3>
              <p className="text-sm leading-6 text-muted-foreground">
                {layer.body}
              </p>
              <div className="mt-auto border-t border-border pt-3">
                <code className="block font-display text-[10px] uppercase tracking-[0.16em] text-foreground/80 sm:text-[11px]">
                  ↳ {layer.example}
                </code>
              </div>
            </article>
          ))}
        </div>

        {/* Build budget callout */}
        <div className="mt-8 grid gap-4 border border-border bg-card p-5 sm:mt-10 sm:grid-cols-[1fr_auto] sm:items-center sm:p-6">
          <div className="min-w-0">
            <p className="font-display text-[10px] uppercase tracking-[0.22em] text-primary">
              The BU economy
            </p>
            <p className="mt-1 text-sm leading-6 text-foreground sm:text-base">
              Every level grants you a <strong>BU budget</strong>. Spend it on
              primitives, and only on primitives. Capabilities, effects, and
              heritages reuse the primitives you have already bought. Take
              penalties or disadvantages to mirror extra primitives back into
              your budget.
            </p>
          </div>
          <Link
            href="/atelier?build=primitive"
            className="sw-cta-ghost inline-flex h-10 w-fit items-center gap-2 border border-border px-4 text-xs font-bold uppercase tracking-[0.14em] text-foreground hover:border-primary/60 hover:text-primary"
          >
            Open the primitive sandbox
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────────────
          04. Fork + version
          ──────────────────────────────────────────────────────────────── */}
      <section className="sw-section border-y border-border bg-card/40 py-14 sm:py-20 lg:py-24">
        <SectionHeading
          index="§30"
          eyebrow="The version envelope"
          title="Anything can be forked. Everything is versioned."
          deck="The library is not a catalogue, it is a forge. Take what someone else made, fork it to your taste, publish your own version, or keep it to your followers. Every primitive, capability, effect, heritage, and item carries a version lineage you can audit, branch from, and roll back."
        />

        {/* Version timeline */}
        <div className="sw-timeline mt-10 overflow-x-auto pb-2 sm:mt-14">
          <ol className="flex min-w-max items-center gap-2 sm:gap-3">
            {[
              { tag: "v.1.0", note: "first published", tone: "muted" },
              { tag: "v.1.1", note: "forked by @user_a", tone: "muted" },
              { tag: "v.1.2", note: "+2 primitives", tone: "primary" },
              { tag: "v.1.3", note: "flagged: balance", tone: "muted" },
              { tag: "v.2.0", note: "rewrite, published", tone: "primary" },
              { tag: "v.2.1", note: "followers only", tone: "accent" },
            ].map((step, i) => (
              <li
                key={step.tag}
                className="flex items-center gap-2 sm:gap-3"
                aria-label={`${step.tag} ${step.note}`}
              >
                <span
                  className={
                    "sw-timeline__node inline-flex flex-col gap-1 border px-3 py-2 font-display text-[10px] uppercase tracking-[0.18em] sm:text-[11px] " +
                    (step.tone === "primary"
                      ? "border-primary bg-primary/10 text-primary"
                      : step.tone === "accent"
                        ? "border-accent bg-accent/10 text-accent-foreground"
                        : "border-border bg-background text-muted-foreground")
                  }
                >
                  <span className="font-bold">{step.tag}</span>
                  <span className="text-[9px] tracking-[0.16em] text-muted-foreground sm:text-[10px]">
                    {step.note}
                  </span>
                </span>
                {i < 5 ? (
                  <span aria-hidden className="text-muted-foreground/60">
                    ──►
                  </span>
                ) : null}
              </li>
            ))}
          </ol>
        </div>

        {/* Fork / version / publish — three actions */}
        <div className="sw-actions mt-10 grid gap-px overflow-hidden border border-border bg-border sm:mt-14 sm:grid-cols-3">
          {[
            {
              n: "I.",
              title: "Fork",
              body:
                "Take anyone's primitive, capability, effect, heritage, or item. Adapt it to your build, your budget, your table. The fork is yours.",
            },
            {
              n: "II.",
              title: "Version",
              body:
                "Publish a new version when your fork changes meaningfully. Old versions stay in the lineage so the table can audit what shifted and why.",
            },
            {
              n: "III.",
              title: "Publish",
              body:
                "Share with the whole codex, your followers only, or keep private. Like, flag, and remix. The community writes the canon together.",
            },
          ].map((action) => (
            <article
              key={action.n}
              className="flex flex-col gap-3 bg-card p-5 sm:p-6"
            >
              <span className="font-display text-[10px] uppercase tracking-[0.22em] text-primary">
                {action.n}
              </span>
              <h4 className="font-display text-xl font-bold uppercase leading-none sm:text-2xl">
                {action.title}
              </h4>
              <p className="text-sm leading-6 text-muted-foreground">
                {action.body}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────────────
          05. The eight core tenets — editorial column
          ──────────────────────────────────────────────────────────────── */}
      <section className="sw-section py-14 sm:py-20 lg:py-24">
        <SectionHeading
          index="§40"
          eyebrow="Core tenets"
          title="How the table is supposed to feel"
          deck="SwordWeave is a heuristic, not a spreadsheet. The rules exist to translate imagination into stakes, never to halt the game for a rules argument. These are the eight working truths of the table."
        />

        <ol className="mt-10 grid gap-x-8 gap-y-8 sm:mt-14 lg:grid-cols-2">
          {TENETS.map((t) => (
            <li
              key={t.n}
              className="sw-tenet group relative grid grid-cols-[auto_1fr] gap-5 border-t border-border pt-6 sm:gap-6"
            >
              <span className="sw-tenet__num font-display text-5xl font-bold leading-none text-primary/70 sm:text-6xl">
                {t.n}
              </span>
              <div className="min-w-0">
                <h4 className="font-display text-lg font-bold uppercase leading-snug sm:text-xl">
                  {t.head}
                </h4>
                <p className="mt-2 text-sm leading-6 text-muted-foreground sm:text-[15px] sm:leading-7">
                  {t.body}
                </p>
              </div>
            </li>
          ))}
        </ol>

        <p className="sw-tenet__signoff mt-12 max-w-2xl border-l-2 border-primary pl-4 font-display text-base uppercase italic text-muted-foreground sm:text-lg">
          It's a game we play in our minds with friends. Do whatever you want.
        </p>
      </section>

      {/* ────────────────────────────────────────────────────────────────
          06. Codex teaser
          ──────────────────────────────────────────────────────────────── */}
      <section className="sw-section border-t border-border py-14 sm:py-20 lg:py-24">
        <SectionHeading
          index="§50"
          eyebrow="The codex"
          title="Open the library"
          deck="Find the base primitives, community capabilities, hand-tuned heritages, and itemised gear. For every budget, every level, every table. Fork anything. Publish what you love."
        />

        <div className="mt-10 grid gap-3 sm:mt-14 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              label: "Primitives",
              meta: "118 published · 4 forks in the last 24h",
              href: "/codex?kind=primitive",
            },
            {
              label: "Capabilities",
              meta: "compiled recipes · ready to slot",
              href: "/codex?kind=capability",
            },
            {
              label: "Effects",
              meta: "maintained states · aura · barrier · summon",
              href: "/codex?kind=effect",
            },
            {
              label: "Heritages",
              meta: "lineage · upbringing · manifest",
              href: "/codex?kind=heritage",
            },
            {
              label: "Items",
              meta: "capability carriers · slot anything in",
              href: "/codex?kind=item",
            },
            {
              label: "Monsters",
              meta: "symmetrical BU budgeting at the table",
              href: "/codex?kind=monster",
            },
          ].map((entry) => (
            <Link
              key={entry.label}
              href={entry.href}
              className="sw-codex-card group flex items-baseline justify-between gap-4 border border-border bg-card p-5 transition-colors hover:border-primary/60 sm:p-6"
            >
              <div className="min-w-0">
                <p className="font-display text-2xl font-bold uppercase leading-none sm:text-3xl">
                  {entry.label}
                </p>
                <p className="mt-2 text-xs text-muted-foreground sm:text-sm">
                  {entry.meta}
                </p>
              </div>
              <ArrowRight className="size-4 shrink-0 text-primary transition-transform group-hover:translate-x-1" />
            </Link>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-start gap-4 border border-primary/30 bg-primary/5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="min-w-0">
            <p className="font-display text-xs uppercase tracking-[0.22em] text-primary">
              First time here?
            </p>
            <p className="mt-1 font-display text-lg uppercase leading-tight sm:text-xl">
              Know who you are, then build everything they can do.
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Walk the eight steps from intent to first roll. No database, no
              account, just the system in plain prose.
            </p>
          </div>
          <Link
            href="/start"
            className="sw-cta-primary inline-flex h-11 w-fit items-center gap-2 bg-primary px-5 text-sm font-bold uppercase tracking-[0.12em] text-primary-foreground"
          >
            Read the walkthrough
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────────────
          07. Bottom marquee — recipe strip
          ──────────────────────────────────────────────────────────────── */}
      <section
        aria-hidden
        className="sw-marquee border-t border-border bg-foreground py-3 text-background dark:bg-primary dark:text-primary-foreground"
      >
        <div className="sw-marquee__track">
          {[...RECIPE_STRIPS, ...RECIPE_STRIPS].map((strip, i) => (
            <span
              key={`${strip}-${i}`}
              className="sw-marquee__item font-display text-sm uppercase tracking-[0.18em] sm:text-base"
            >
              <span className="mr-6 text-background/60 dark:text-primary-foreground/60">
                ·
              </span>
              {strip}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}

// =============================================================================
// SectionHeading — uniform editorial section opener used throughout.
// Big eyebrow + headline + deck. Server-renderable, no client state.
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
        <span className="font-display text-[10px] uppercase tracking-[0.28em] text-primary lg:hidden">
          {index} · {eyebrow}
        </span>
        <span className="mb-2 hidden text-xs uppercase tracking-[0.22em] text-muted-foreground lg:inline">
          {eyebrow}
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
