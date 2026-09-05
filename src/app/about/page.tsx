import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import type { Metadata } from "next";

// =============================================================================
// /about — the people and the project
//
// Short, low-page. The bio paragraph is the lead. Project facts sit below as a
// footer-style citation block. No client JS. Same editorial language as the
// homepage.
// =============================================================================

export const metadata: Metadata = {
  title: "About · SwordWeave",
  description:
    "SwordWeave is built by Marius Ion, one person, no publisher. CC-BY-4.0.",
};

// Project facts shown in the footer-style citation block.
type ProjectFact = {
  label: string;
  value: string;
  note: string;
  href?: string | undefined;
};

const PROJECT_FACTS: readonly ProjectFact[] = [
  {
    label: "Builder",
    value: "Marius Ion",
    note: "one person, no team, no publisher",
  },
  {
    label: "License",
    value: "CC-BY-4.0",
    note: "share, remix, build on it. credit me.",
    href: "https://creativecommons.org/licenses/by/4.0/",
  },
  {
    label: "Engine version",
    value: "v.0.1.0",
    note: "early build. expect sharp edges.",
  },
  {
    label: "First published",
    value: "MMXXVI",
    note: "the year of the rewrite",
  },
];

const ATTRIBUTIONS: readonly ProjectFact[] = [
  {
    label: "Icon set",
    value: "game-icons.net",
    note: "4,180 icons · 36 artists · CC BY 3.0 + CC0",
    href: "https://game-icons.net/",
  },
  {
    label: "Tech",
    value: "Next.js · Drizzle · Neon Postgres · Clerk",
    note: "open-source stack. no proprietary dependencies.",
  },
];

export default function AboutPage() {
  return (
    <div className="sw-home relative mx-auto w-full max-w-[1100px] px-4 pb-24 pt-4 sm:px-6 sm:pt-6 lg:px-10 lg:pt-8">
      {/* Top marginalia bar — same as homepage + /start */}
      <div className="sw-marginalia sw-marginalia--top mb-10 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-border pb-3 text-[10px] uppercase tracking-[0.22em] text-muted-foreground sm:text-xs">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
          <Link href="/" className="font-display text-foreground hover:text-primary">
            Sword<span className="text-primary">·</span>Weave
          </Link>
          <span>About</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
          <Link href="/start" className="hover:text-foreground">
            Read the walkthrough
          </Link>
          <Link href="/codex" className="hover:text-foreground">
            Open the codex
          </Link>
        </div>
      </div>

      {/* Hero — small, the bio IS the hero */}
      <section className="sw-hero relative grid gap-8 pb-12 sm:pb-16 lg:grid-cols-[64px_1fr] lg:gap-10 lg:pb-20">
        <div aria-hidden className="sw-running-head hidden lg:block">
          <span>SW · ABOUT · ONE PERSON</span>
        </div>

        <div className="min-w-0">
          <div className="mb-3 inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.28em] text-primary lg:hidden">
            <span className="size-1.5 rounded-full bg-primary" />
            About
          </div>

          <h1 className="font-display text-[clamp(2.5rem,7vw,5rem)] font-bold uppercase leading-[0.92] tracking-tight">
            <span className="block">A game for</span>
            <span className="block">
              <span className="sw-headline__weave">friends</span> who play
            </span>
            <span className="block text-muted-foreground">in their heads.</span>
          </h1>

          {/* Bio — your words */}
          <div className="mt-8 max-w-2xl border-l-2 border-primary pl-5">
            <p className="font-display text-[10px] uppercase tracking-[0.22em] text-primary">
              Why I built this
            </p>
            <p className="mt-3 text-lg leading-8 text-foreground sm:text-xl sm:leading-9">
              I started because I wanted a natural game system without so many
              rules. A game friends would play. Where things are flexible and
              decided at a table not rigid.
            </p>
            <p className="mt-3 text-lg leading-8 text-foreground sm:text-xl sm:leading-9">
              I want it open source because that is the way. If I want an
              impact I cannot gate keep it.
            </p>
            <p className="mt-5 text-sm text-muted-foreground sm:text-base">
              Marius Ion · the only person on this project
            </p>
          </div>
        </div>
      </section>

      {/* Project facts — citation block */}
      <section className="sw-section border-t border-border pt-10 sm:pt-14">
        <h2 className="font-display text-[10px] uppercase tracking-[0.28em] text-primary sm:text-xs">
          Project facts
        </h2>

        <dl className="mt-5 grid gap-px overflow-hidden border border-border bg-border sm:grid-cols-2">
          {PROJECT_FACTS.map((fact) => (
            <div
              key={fact.label}
              className="flex flex-col gap-1 bg-card p-5 sm:p-6"
            >
              <dt className="font-display text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                {fact.label}
              </dt>
              <dd className="mt-1 font-display text-xl font-bold uppercase leading-none sm:text-2xl">
                {fact.href ? (
                  <Link
                    href={fact.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 hover:text-primary"
                  >
                    {fact.value}
                    <ArrowUpRight className="size-3.5" />
                  </Link>
                ) : (
                  fact.value
                )}
              </dd>
              <dd className="mt-1 text-xs text-muted-foreground sm:text-sm">
                {fact.note}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Attributions — citation block */}
      <section className="sw-section border-t border-border pt-10 sm:pt-14">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <h2 className="font-display text-[10px] uppercase tracking-[0.28em] text-primary sm:text-xs">
            Attributions
          </h2>
          <Link
            href="/attributions"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground sm:text-sm"
          >
            Full attributions list
            <ArrowUpRight className="size-3" />
          </Link>
        </div>

        <dl className="mt-5 grid gap-px overflow-hidden border border-border bg-border sm:grid-cols-2">
          {ATTRIBUTIONS.map((att) => (
            <div
              key={att.label}
              className="flex flex-col gap-1 bg-card p-5 sm:p-6"
            >
              <dt className="font-display text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                {att.label}
              </dt>
              <dd className="mt-1 font-display text-xl font-bold uppercase leading-none sm:text-2xl">
                {att.href ? (
                  <Link
                    href={att.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 hover:text-primary"
                  >
                    {att.value}
                    <ArrowUpRight className="size-3.5" />
                  </Link>
                ) : (
                  att.value
                )}
              </dd>
              <dd className="mt-1 text-xs text-muted-foreground sm:text-sm">
                {att.note}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Closing — keep it short */}
      <section className="sw-section border-t border-border pt-10 sm:pt-14">
        <p className="max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base sm:leading-8">
          That is the project. One person, one open license, one rule of
          cool. If you want to follow along, fork the repo, or publish your
          own primitives and capabilities into the codex, the door is open.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/start"
            className="sw-cta-primary inline-flex h-11 items-center gap-2 bg-primary px-5 text-sm font-bold uppercase tracking-[0.12em] text-primary-foreground"
          >
            Read the walkthrough
            <ArrowRight className="size-4" />
          </Link>
          <Link
            href="/"
            className="sw-cta-ghost inline-flex h-11 items-center gap-2 border border-border bg-card px-5 text-sm font-bold uppercase tracking-[0.12em] text-foreground hover:border-primary/60 hover:text-primary"
          >
            Back to homepage
          </Link>
        </div>
      </section>
    </div>
  );
}
