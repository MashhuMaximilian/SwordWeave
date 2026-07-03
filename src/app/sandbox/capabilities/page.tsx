import Link from "next/link";
import { ArrowRight, CircuitBoard, Swords } from "lucide-react";

export default function CapabilitiesSandboxPage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-8">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold uppercase text-muted-foreground">
          Capability Compiler
        </p>
        <h1 className="mt-3 text-4xl font-semibold">
          Turn grammar into action cards.
        </h1>
        <p className="mt-4 text-base leading-7 text-muted-foreground">
          This workspace will assemble capability templates from verbs, domains,
          ranges, durations, and nested effects.
        </p>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-[360px_1fr]">
        <section className="rounded-md border border-border bg-card p-5">
          <CircuitBoard className="size-5 text-primary" />
          <h2 className="mt-5 text-lg font-semibold">Compiler Inputs</h2>
          <div className="mt-4 grid gap-2 text-sm text-muted-foreground">
            <p>Source type: physical, magical, or psychic.</p>
            <p>Execution type: active, passive, or augment.</p>
            <p>Primitive slots: verbs, domains, ranges, durations.</p>
            <p>Effect slots: packed reusable rule packages.</p>
          </div>
        </section>

        <Link
          className="group flex min-h-72 flex-col rounded-md border border-border bg-card p-5 transition-colors hover:border-primary"
          href="/sandbox/effects"
        >
          <Swords className="size-5 text-primary" />
          <h2 className="mt-5 text-lg font-semibold">Card Preview Comes Next</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            Once effects can be assembled, this page can compile a true
            SwordWeave capability card with CV, targets, nested conditions, and
            narrative description.
          </p>
          <span className="mt-auto flex items-center gap-2 pt-6 text-sm font-medium text-primary">
            Review effect plan
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
          </span>
        </Link>
      </div>
    </div>
  );
}
