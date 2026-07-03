import Link from "next/link";
import { ArrowRight, Gauge, UserRound } from "lucide-react";

export default function CharactersPage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-8">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold uppercase text-muted-foreground">
          Character Ledgers
        </p>
        <h1 className="mt-3 text-4xl font-semibold">
          Player sheets will spend, mirror, and recalculate BU live.
        </h1>
        <p className="mt-4 text-base leading-7 text-muted-foreground">
          This route is reserved for account-backed characters, progression BU
          budgets, owned primitives, active loadouts, and editable penalty caps.
        </p>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <section className="rounded-md border border-border bg-card p-5">
          <Gauge className="size-5 text-primary" />
          <h2 className="mt-5 text-lg font-semibold">Budget Controls</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Character creation should support level-derived BU or a manually set
            BU budget, plus an editable maximum penalty tier for mirrored
            drawbacks.
          </p>
        </section>

        <Link
          className="group flex flex-col rounded-md border border-border bg-card p-5 transition-colors hover:border-primary"
          href="/sandbox/primitives"
        >
          <UserRound className="size-5 text-primary" />
          <h2 className="mt-5 text-lg font-semibold">Foundation Dependency</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Character sheets become powerful once primitives can be bought,
            customized, mirrored, and imported from the library.
          </p>
          <span className="mt-auto flex items-center gap-2 pt-6 text-sm font-medium text-primary">
            Open primitive sandbox
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
          </span>
        </Link>
      </div>
    </div>
  );
}
