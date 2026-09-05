import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import type { Metadata } from "next";
import { PublicNav } from "@/components/home/public-nav";

// =============================================================================
// /combat — The Combat Rhythm and Action Economy, in plain prose.
//
// Source-of-truth: src/docs/Action_Economy_System_Canonical.pdf and
// src/docs/The_Combat_Rhythm.pdf. The prose below is a re-typesetting of those
// canonical documents. The engine implements these as the round structure that
// the rest of the site describes in shorthand ("3 Dials", "Strain", "Cost").
//
// Server component, no DB, no client JS. PublicNav gives the top nav.
// =============================================================================

export const metadata: Metadata = {
  title: "Combat · SwordWeave",
  description:
    "The Combat Rhythm and Action Economy. Council Phase, complexity tracks, the reaction slot, channelled actions.",
};

const TRACKS = [
  {
    code: "Fast",
    complexity: "Complexity 0 to 1",
    label: "Immediate, instinctive, simple",
    examples: [
      "strike a nearby enemy",
      "move behind cover",
      "draw and throw a dagger",
      "pull an ally out of immediate danger",
      "raise a shield against an obvious threat",
    ],
    note: "These intents resolve first. They enter the fiction before Measured or Heavy.",
  },
  {
    code: "Measured",
    complexity: "Complexity 2 to 3",
    label: "Deliberate, layered, standard capability",
    examples: [
      "attack while repositioning through hostile space",
      "create a barrier and use it to divide two enemies",
      "freeze the floor beneath a charging creature",
      "teleport to an ally and carry them to safety",
    ],
    note: "Resolves after Fast. The bread and butter of a standard capability assembly.",
  },
  {
    code: "Heavy",
    complexity: "Complexity 4 plus",
    label: "Reality-pressure, extreme concentration",
    examples: [
      "collapse a tower while shielding nearby allies",
      "freeze a river and reshape it into a bridge",
      "teleport several creatures through different locations",
      "create a scene-wide storm while maintaining another effect",
    ],
    note: "Resolves last. The character must still be capable of completing the intent by the time the Heavy track fires.",
  },
] as const;

const SECTIONS = [
  {
    n: "01",
    title: "The round economy",
    sub: "what every character has, every round",
    body: [
      "During each combat round, every character receives the same baseline resources. None of these are bonuses. None of them are class features. They are structural.",
      "One Main Intent. One Reaction Slot. Movement as part of their intent. Any ongoing effects, upkeep obligations, or passive capabilities currently active. These resources reset at the beginning of the next Council Phase unless a rule states otherwise.",
    ],
    pullquote: "Combat does not divide the scene into isolated individual turns. It is a shared round.",
  },
  {
    n: "02",
    title: "The Council Phase",
    sub: "openly declare your intent before anything resolves",
    body: [
      "At the beginning of every combat round, the table pauses briefly. During this pause, every player openly declares their character's Main Intent in plain, natural language. Players are encouraged to coordinate, warn one another, and construct a shared tactical plan rather than hiding their actions behind individual turns.",
      "At the same time, the GM establishes the visible focus and general intent of the opposing forces. Players do not need to describe every mechanical component immediately. They only need to establish what their character is attempting to accomplish.",
      "Once every Main Intent is understood, the GM determines when each action enters the fiction.",
    ],
    dialogue: [
      { who: "Player", text: "I rush the bridge and hold back the armored guard." },
      { who: "Player", text: "I create a wall of fire behind him so he cannot retreat." },
      { who: "Player", text: "I pull the wounded scout away from the ledge." },
      { who: "Player", text: "I begin folding the chamber inward to trap the creature." },
    ],
    after: [
      "The Council Phase is not a lengthy strategy meeting. It is a brief snapshot of everyone's intentions at the opening of the round.",
    ],
  },
  {
    n: "03",
    title: "Assigning the complexity tracks",
    sub: "fast, measured, heavy. based on what the intent actually needs",
    body: [
      "Once every Main Intent is on the table, the GM evaluates the Complexity of each. Complexity does more than influence Strain. During combat, it determines how quickly an action can manifest inside the shared scene. Actions are placed into one of three chronological tracks.",
      "The tracks do not measure how impressive an action is. They measure how much must happen before the intent can fully enter reality. A sword thrust resolves before a dimensional prison, not because the sword is stronger, but because it is already moving while the prison is still being constructed.",
    ],
  },
  {
    n: "04",
    title: "Resolving within a track",
    sub: "symmetrical flow, the reaction clash, the active contest",
    body: [
      "Once all actions have been assigned to tracks, resolve them in order: Fast, then Measured, then Heavy.",
      "When multiple characters occupy the same track, do not automatically roll for initiative. Use the three rules below.",
    ],
    rules: [
      {
        head: "Symmetrical Flow",
        body: "If only allies are acting within a track, the players choose the order that best supports their coordinated intent. If only adversaries are acting, the GM resolves them in the order that best reflects the fiction. No speed roll is required. Characters on the same side are not racing one another unless the narrative gives them a reason to do so.",
      },
      {
        head: "The Reaction Clash",
        body: "When an ally's intent and an adversary's intent directly collide within the same track and the outcome depends on who acts first, a Reaction Clash occurs. Both sides roll: Reaction Clash = 1d20 plus relevant attribute modifier plus Proficiency Bonus if trained. The higher result acts first. If tied, the GM resolves simultaneously or lets the side with the stronger fictional position act first. The losing character does not automatically lose their entire action. They may use the Pivot Point to immediately adjust it before it resolves.",
      },
      {
        head: "The Active Contest",
        body: "Not every collision is a race. When two opposing intents create a direct physical, mental, or magical struggle, resolve the conflict as an Active Contest. Each side makes a standard resolution roll using the attribute, skill, capability, or equipment most relevant. The higher result wins the struggle and dictates the immediate narrative outcome. A Reaction Clash asks 'Who gets there first?'. An Active Contest asks 'Whose intent overpowers the other?'.",
      },
    ],
  },
  {
    n: "05",
    title: "The main intent in practice",
    sub: "movement, linked actions, no hidden categories",
    body: [
      "A character's Main Intent is the primary thing they attempt to accomplish during the round. It may be a physical attack, an activated capability, manipulating the environment, defending a position, assisting an ally, moving through the battlefield, performing a linked sequence of actions, or beginning or completing a complex channelled effect.",
      "The player describes the entire intent in plain, natural language. They do not divide it into separate categories such as Action, Bonus Action, and Movement.",
    ],
    example: {
      label: "Wrong framing",
      lines: ["I move thirty feet, use my action to attack,", "and use a bonus action to disengage."],
      tone: "warn" as const,
    },
    example2: {
      label: "Right framing",
      lines: [
        "I sprint past the guard, slash at his exposed side,",
        "and continue behind the stone pillar before he can surround me.",
      ],
      tone: "ok" as const,
    },
    after: [
      "Movement is not a separate action resource. A character may move whenever movement is a logical part of what they are attempting. Movement is free to describe, but it is never free from the fiction. Ordinary movement usually adds little or no Complexity. Movement increases Complexity when it introduces meaningful additional challenge (crossing dangerous terrain, climbing while under attack, dragging a wounded ally, and so on).",
      "A Main Intent may contain more than one physical step as long as those steps form one coherent objective. The GM does not count verbs. The GM asks: 'Is this one connected intent, or several independent outcomes being compressed together?'. If every part of the action contributes directly to one objective, it may resolve as a single intent. If the character is attempting several unrelated outcomes, the GM may increase Complexity, increase Strain or Cost, reduce the scope of the intent, or split the intent into sequential resolutions.",
    ],
  },
  {
    n: "06",
    title: "The reaction slot",
    sub: "one independent response per round",
    body: [
      "Every character has one Reaction Slot per round. It is independent of the character's Main Intent. It may be used before or after the Main Intent resolves.",
      "A reaction must answer a clear event occurring within the fiction. Possible triggers include an enemy attacks an ally, a creature moves past the character, a trap activates, a projectile enters reach, an ally falls, a spell begins forming, a nearby structure collapses, a creature attempts to escape. Possible reactions include dodge, block, counter, interrupt, catch, pull, a brief retaliatory strike, activating a defensive capability, moving a very short distance in direct response to danger.",
    ],
    rules: [
      {
        head: "Reaction scope",
        body: "By default, a reaction is limited to: Scale self / touch or single target, Complexity 0 to 1, Duration immediate, Purpose directly responding to the triggering event. A small amount of reflexive movement is allowed when necessary.",
      },
      {
        head: "What a reaction should not do",
        body: "A reaction should not normally affect a large area, create several independent effects, require long concentration, perform a full tactical sequence, duplicate the scope of a Main Intent, or resolve an action that was clearly planned during the Council Phase.",
      },
      {
        head: "Timing and the reaction interrupt",
        body: "When a reaction is declared: pause the triggering action, confirm the reaction is possible, evaluate its Complexity / Strain / Cost, resolve any required Clash / Contest / standard roll, continue resolving the triggering action according to the new circumstances. A reaction does not automatically cancel its trigger. It changes the situation, and the fiction determines what remains possible.",
      },
    ],
  },
  {
    n: "07",
    title: "Channelled and maintained actions",
    sub: "when an intent cannot resolve in a single moment",
    body: [
      "Some intents cannot fully resolve within a single moment. A character may begin a channelled action as their Main Intent. Until it resolves, they may need to maintain concentration, pay an upkeep Cost, remain in position, protect a focus or component, avoid interruption.",
      "A channelled action remains part of the character's Main Intent for that round. It does not grant additional actions simply because its final effect has not yet manifested.",
      "If the character is disrupted before completion, the GM determines whether the intent: fails, resolves at reduced strength, requires an additional Cost, continues into the next round, or can be redirected using the Pivot Point.",
    ],
    pullquote: "Channelled actions are not free turns. They are the same Main Intent, played out over more than one round.",
  },
  {
    n: "08",
    title: "No hidden action categories",
    sub: "the system does not use standard, bonus, or move actions",
    body: [
      "The system does not use Standard Actions, Bonus Actions, Move Actions, Free Object Interactions, Full-Round Actions, or Minor Actions. Those categories are replaced by one question:",
    ],
    pullquote: "What is your character trying to accomplish during this round?",
    after: [
      "The GM evaluates the answer through Scale, Impact, Complexity, Strain, Cost, and the established fiction. Simple actions remain fast and inexpensive. Layered actions become slower or more demanding. Extreme actions remain possible, but reality demands an appropriate price.",
    ],
  },
  {
    n: "09",
    title: "A round, end to end",
    sub: "the full sequence, no roleplay, just structure",
    body: [
      "The complete combat sequence, in order.",
    ],
    sequence: [
      {
        step: "01",
        label: "The Council Phase",
        body: "Reaction Slots reset. Players declare their Main Intents in plain language. The GM establishes adversary intents. The table clarifies positioning and coordination.",
      },
      {
        step: "02",
        label: "Evaluation",
        body: "The GM reads the 3 Dials (Scale, Impact, Complexity). Strain and Cost are established. Each Main Intent is placed into a Complexity Track.",
      },
      {
        step: "03",
        label: "Resolution",
        body: "Fast Track resolves. Measured Track resolves. Heavy Track resolves. Clashes and Active Contests resolve direct conflicts. Reactions interrupt whenever their triggers occur.",
      },
      {
        step: "04",
        label: "End of Round",
        body: "Resolve end-of-round effects. Apply ongoing consequences. Pay or note required upkeep. Begin the next Council Phase.",
      },
    ],
  },
  {
    n: "10",
    title: "Heuristics, not rules",
    sub: "the rule of cool is still the ultimate law",
    body: [
      "The action economy is not balanced by restricting characters to artificial mechanical slots. It is balanced through Complexity, Strain, Vitality Cost, capability ownership, positioning, narrative consequence, reaction limits, and the time required for an intent to manifest.",
      "Capabilities define what a character has mastered. The Action Economy defines how those capabilities enter the shared scene. The Initiative System determines when they arrive. Together, these systems preserve cinematic freedom without allowing every intent to become an unlimited chain of unrelated effects.",
      "If the fiction strongly supports a more ambitious reaction, the GM may permit it by increasing Strain, imposing a severe Cost, reducing its effect, or introducing an immediate complication. A reaction may bend its limits, but it never escapes consequence.",
    ],
    signoff: true,
  },
] as const;

export default function CombatPage() {
  return (
    <div className="sw-home relative mx-auto w-full max-w-[1400px] px-4 pb-24 pt-16 sm:px-6 sm:pt-16 lg:px-10 lg:pt-16">
      <PublicNav />

      <div className="sw-marginalia sw-marginalia--top mb-10 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-border pb-3 text-[10px] uppercase tracking-[0.22em] text-muted-foreground sm:text-xs">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
          <Link href="/" className="font-display text-foreground hover:text-primary">
            Sword<span className="text-primary">·</span>Weave
          </Link>
          <span>Combat</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
          <span aria-hidden className="text-primary/70">
            §00–§10 · ten sections
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
          <span>SW · COMBAT · ACTION ECONOMY</span>
        </div>

        <div className="min-w-0">
          <div className="mb-3 inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.28em] text-primary lg:hidden">
            <span className="size-1.5 rounded-full bg-primary" />
            Combat
          </div>

          <h1 className="font-display text-[clamp(2.25rem,7vw,5.5rem)] font-bold uppercase leading-[0.9] tracking-tight">
            <span className="block">A fight is</span>
            <span className="block">
              happening <span className="sw-headline__under">all at once</span>.
            </span>
            <span className="block text-muted-foreground">Not in turns.</span>
          </h1>

          <p className="mt-6 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
            Blades are moving, spells are forming, allies are shouting warnings,
            and enemies are reacting to the same collapsing situation. Combat is
            a shared round, not a queue. This page is the engine's actual
            round structure, the three complexity tracks, and the reaction
            slot, in plain prose.
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
              href="/character"
              className="sw-cta-ghost inline-flex h-11 items-center gap-2 border border-border bg-card px-5 text-sm font-bold uppercase tracking-[0.12em] text-foreground hover:border-primary/60 hover:text-primary"
            >
              Build a character first
            </Link>
          </div>
        </div>
      </section>

      {/* At-a-glance panel */}
      <section className="sw-section relative border-y border-border bg-card/40 py-12 sm:py-16 lg:py-20">
        <SectionHeading
          index="§00"
          eyebrow="At a glance"
          title="What every character has per round"
          deck="Four structural resources. None of them are bonuses. None of them are class features. They reset at the start of the next Council Phase."
        />

        <div className="mt-10 grid gap-px overflow-hidden border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-2 bg-card p-5 sm:p-6">
            <span className="font-display text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              01
            </span>
            <p className="font-display text-xl font-bold uppercase leading-none sm:text-2xl">
              One Main Intent
            </p>
            <p className="text-xs text-muted-foreground sm:text-sm">
              The primary thing you attempt this round. Describe it in plain language.
            </p>
          </div>
          <div className="flex flex-col gap-2 bg-card p-5 sm:p-6">
            <span className="font-display text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              02
            </span>
            <p className="font-display text-xl font-bold uppercase leading-none sm:text-2xl">
              One Reaction Slot
            </p>
            <p className="text-xs text-muted-foreground sm:text-sm">
              An independent response to a triggering event. Independent of your Main Intent.
            </p>
          </div>
          <div className="flex flex-col gap-2 bg-card p-5 sm:p-6">
            <span className="font-display text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              03
            </span>
            <p className="font-display text-xl font-bold uppercase leading-none sm:text-2xl">
              Movement as part of intent
            </p>
            <p className="text-xs text-muted-foreground sm:text-sm">
              Not a separate resource. Free to describe, but never free from the fiction.
            </p>
          </div>
          <div className="flex flex-col gap-2 bg-card p-5 sm:p-6">
            <span className="font-display text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              04
            </span>
            <p className="font-display text-xl font-bold uppercase leading-none sm:text-2xl">
              Active effects and upkeep
            </p>
            <p className="text-xs text-muted-foreground sm:text-sm">
              Anything currently maintained, channelled, or running carries forward.
            </p>
          </div>
        </div>
      </section>

      {/* Three complexity tracks panel */}
      <section className="sw-section relative py-14 sm:py-20 lg:py-24">
        <SectionHeading
          index="§01"
          eyebrow="The three tracks"
          title="Fast, Measured, Heavy"
          deck="After the Council Phase, the GM places every Main Intent into one of three chronological tracks based on its Complexity. Tracks resolve in order. Within a track, Symmetrical Flow, the Reaction Clash, and the Active Contest decide collisions."
        />

        <div className="mt-10 grid gap-px overflow-hidden border border-border bg-border lg:grid-cols-3">
          {TRACKS.map((track) => (
            <div key={track.code} className="flex flex-col gap-3 bg-card p-5 sm:p-6">
              <div className="flex items-baseline justify-between gap-3">
                <p className="font-display text-2xl font-bold uppercase tracking-tight sm:text-3xl">
                  {track.code}
                </p>
                <p className="font-display text-[10px] uppercase tracking-[0.22em] text-primary">
                  {track.complexity}
                </p>
              </div>
              <p className="font-display text-xs uppercase tracking-[0.22em] text-muted-foreground">
                {track.label}
              </p>
              <ul className="mt-2 space-y-2 border-t border-border/50 pt-3">
                {track.examples.map((ex, j) => (
                  <li
                    key={j}
                    className="border-l-2 border-primary/30 pl-3 text-sm leading-6 text-foreground sm:text-base sm:leading-7"
                  >
                    {ex}
                  </li>
                ))}
              </ul>
              <p className="mt-2 border-t border-border/50 pt-3 text-xs italic leading-6 text-muted-foreground sm:text-sm sm:leading-7">
                {track.note}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Ten sections */}
      <section className="sw-section pb-14 sm:pb-20 lg:pb-24">
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

                {"dialogue" in section && section.dialogue && (
                  <div className="mt-6 space-y-2 border-l-2 border-primary/40 pl-4">
                    {section.dialogue.map((line, j) => (
                      <p
                        key={j}
                        className="font-display text-sm leading-7 text-foreground sm:text-base sm:leading-8"
                      >
                        <span className="text-[10px] uppercase tracking-[0.22em] text-primary">
                          {line.who}
                        </span>
                        <span className="ml-3 italic">"{line.text}"</span>
                      </p>
                    ))}
                  </div>
                )}

                {"after" in section && section.after && (
                  <div className="mt-5 space-y-3 text-sm leading-7 text-muted-foreground sm:text-base sm:leading-8">
                    {section.after.map((para, j) => (
                      <p key={j}>{para}</p>
                    ))}
                  </div>
                )}

                {"rules" in section && section.rules && (
                  <ul className="mt-7 space-y-4">
                    {section.rules.map((rule, j) => (
                      <li
                        key={j}
                        className="border-l-2 border-primary/40 pl-4"
                      >
                        <p className="font-display text-base font-bold uppercase tracking-tight sm:text-lg">
                          {rule.head}
                        </p>
                        <p className="mt-1 text-sm leading-6 text-foreground sm:text-base sm:leading-7">
                          {rule.body}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}

                {"pullquote" in section && section.pullquote && (
                  <blockquote className="sw-tenet__signoff mt-7 max-w-2xl border-l-2 border-primary pl-4 font-display text-lg uppercase italic text-muted-foreground sm:text-xl">
                    {section.pullquote}
                  </blockquote>
                )}

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

                {"example2" in section && section.example2 && (
                  <figure className="sw-recipe mt-3 border border-primary/40 bg-primary/5 p-5 sm:p-6">
                    <figcaption className="font-display text-[10px] uppercase tracking-[0.22em] text-primary">
                      {section.example2.label}
                    </figcaption>
                    <pre className="mt-3 whitespace-pre-wrap font-display text-xs leading-[1.7] text-foreground sm:text-sm">
                      {section.example2.lines.join("\n")}
                    </pre>
                  </figure>
                )}

                {"sequence" in section && section.sequence && (
                  <ol className="mt-7 space-y-5">
                    {section.sequence.map((s) => (
                      <li
                        key={s.step}
                        className="grid grid-cols-[auto_1fr] gap-4 border-l-2 border-primary pl-4"
                      >
                        <span className="font-display text-xl font-bold text-primary sm:text-2xl">
                          {s.step}
                        </span>
                        <div>
                          <p className="font-display text-base font-bold uppercase tracking-tight sm:text-lg">
                            {s.label}
                          </p>
                          <p className="mt-1 text-sm leading-6 text-foreground sm:text-base sm:leading-7">
                            {s.body}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}

                {"signoff" in section && section.signoff && (
                  <p className="sw-tenet__signoff mt-8 max-w-2xl border-l-2 border-primary pl-4 font-display text-base uppercase italic text-muted-foreground sm:text-lg">
                    The rule of cool is still the ultimate law of the table.
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
            href="/character"
            className="sw-codex-card group flex items-baseline justify-between gap-4 border border-border bg-card p-5 transition-colors hover:border-primary/60 sm:p-6"
          >
            <div className="min-w-0">
              <p className="font-display text-[10px] uppercase tracking-[0.22em] text-primary">
                Before you fight
              </p>
              <p className="mt-1 font-display text-2xl font-bold uppercase leading-none sm:text-3xl">
                Build a character
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Five decisions and a mirror to play with. Pick what they can
                do before you decide what they do.
              </p>
            </div>
            <ArrowRight className="size-5 shrink-0 text-primary transition-transform group-hover:translate-x-1" />
          </Link>

          <Link
            href="/codex?kind=capability"
            className="sw-codex-card group flex items-baseline justify-between gap-4 border border-border bg-card p-5 transition-colors hover:border-primary/60 sm:p-6"
          >
            <div className="min-w-0">
              <p className="font-display text-[10px] uppercase tracking-[0.22em] text-primary">
                What you can do with a turn
              </p>
              <p className="mt-1 font-display text-2xl font-bold uppercase leading-none sm:text-3xl">
                Browse capabilities
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Compiled recipes from the community. Fork what you like,
                publish what you love, slot them into heritages and items.
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
