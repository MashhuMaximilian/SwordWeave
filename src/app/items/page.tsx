import Link from "next/link";
import { ArrowRight, Package, Sparkles } from "lucide-react";

export default function ItemsPage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-8">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold uppercase text-muted-foreground">
          Item Ledger
        </p>
        <h1 className="mt-3 text-4xl font-semibold">
          Equipment as carriers for effects and capabilities.
        </h1>
        <p className="mt-4 text-base leading-7 text-muted-foreground">
          Items will attach passive effects, active capability cards, slot
          costs, rarity, focus behavior, and exported equipment packages.
        </p>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <section className="rounded-md border border-border bg-card p-5">
          <Package className="size-5 text-primary" />
          <h2 className="mt-5 text-lg font-semibold">Carrier Model</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            A sword, armor, trinket, or artifact can carry the same effect and
            capability records that characters and monsters use.
          </p>
        </section>

        <Link
          className="group flex flex-col rounded-md border border-border bg-card p-5 transition-colors hover:border-primary"
          href="/sandbox/grammar?build=effect"
        >
          <Sparkles className="size-5 text-primary" />
          <h2 className="mt-5 text-lg font-semibold">Passive Slot Dependency</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Item passives should slot effects once the effect builder can
            package primitive groups cleanly.
          </p>
          <span className="mt-auto flex items-center gap-2 pt-6 text-sm font-medium text-primary">
            Open effect plan
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
          </span>
        </Link>
      </div>
    </div>
  );
}
