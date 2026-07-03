import Link from "next/link";
import { ArrowRight, Shield, Swords } from "lucide-react";

export default function MonstersPage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-8">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold uppercase text-muted-foreground">
          Monster Workspace
        </p>
        <h1 className="mt-3 text-4xl font-semibold">
          DM-ready entities using the same capability engine.
        </h1>
        <p className="mt-4 text-base leading-7 text-muted-foreground">
          Monsters will use compressed sheets, encounter BU weight, quick-action
          cards, and importable templates.
        </p>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <section className="rounded-md border border-border bg-card p-5">
          <Shield className="size-5 text-primary" />
          <h2 className="mt-5 text-lg font-semibold">Encounter Weight</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Monster BU plus equipped item BU should produce a readable encounter
            budget without forcing DMs through player progression checklists.
          </p>
        </section>

        <Link
          className="group flex flex-col rounded-md border border-border bg-card p-5 transition-colors hover:border-primary"
          href="/sandbox/capabilities"
        >
          <Swords className="size-5 text-primary" />
          <h2 className="mt-5 text-lg font-semibold">Action Deck Dependency</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Monster profiles become useful once capability cards can be compiled
            and slotted as reusable actions.
          </p>
          <span className="mt-auto flex items-center gap-2 pt-6 text-sm font-medium text-primary">
            Open capability plan
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
          </span>
        </Link>
      </div>
    </div>
  );
}
