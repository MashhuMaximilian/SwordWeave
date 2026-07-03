import Link from "next/link";
import { ArrowRight, Boxes, Sparkles } from "lucide-react";

export default function EffectsSandboxPage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-8">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold uppercase text-muted-foreground">
          Effect Builder
        </p>
        <h1 className="mt-3 text-4xl font-semibold">
          Stack primitives into reusable states.
        </h1>
        <p className="mt-4 text-base leading-7 text-muted-foreground">
          This will become the drag-and-slot workspace for conditions, effects,
          live BU totals, and generated rules cards.
        </p>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-[1fr_360px]">
        <section className="rounded-md border border-border bg-card p-5">
          <div className="flex items-center gap-3">
            <Sparkles className="size-5 text-primary" />
            <h2 className="text-lg font-semibold">Planned Assembly Flow</h2>
          </div>
          <div className="mt-5 grid gap-3 text-sm text-muted-foreground">
            <p>1. Filter primitive library by category and tags.</p>
            <p>2. Slot primitives into a named condition or effect.</p>
            <p>3. Calculate total BU from slotted primitives.</p>
            <p>4. Export the effect as a JSON package for reuse.</p>
          </div>
        </section>

        <Link
          className="group flex flex-col rounded-md border border-border bg-card p-5 transition-colors hover:border-primary"
          href="/sandbox/primitives"
        >
          <Boxes className="size-5 text-primary" />
          <h2 className="mt-5 text-lg font-semibold">Start With Primitives</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Effects depend on a healthy atomic registry, so primitives remain
            the live implementation target first.
          </p>
          <span className="mt-auto flex items-center gap-2 pt-6 text-sm font-medium text-primary">
            Open primitives
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
          </span>
        </Link>
      </div>
    </div>
  );
}
