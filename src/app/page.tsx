import Link from "next/link";
import {
  ArrowRight,
  Boxes,
  Download,
  FlaskConical,
  Library,
  Upload,
} from "lucide-react";

const workspaces = [
  {
    href: "/sandbox/primitives",
    title: "Primitive Sandbox",
    label: "Live",
    description:
      "Create atomic BU blocks with human-readable outputs, mirror vectors, and generated modifier JSON.",
    icon: Boxes,
  },
  {
    href: "/sandbox/effects",
    title: "Effect Builder",
    label: "Next",
    description:
      "Stack primitives into reusable conditions and named state packages.",
    icon: FlaskConical,
  },
  {
    href: "/sandbox/capabilities",
    title: "Capability Compiler",
    label: "Planned",
    description:
      "Assemble verbs, domains, ranges, and effects into playable action cards.",
    icon: ArrowRight,
  },
  {
    href: "/library",
    title: "Library Exchange",
    label: "Planned",
    description:
      "Browse, clone, import, and export SwordWeave packages across object types.",
    icon: Library,
  },
] as const;

export default function HomePage() {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 py-8">
      <section className="grid gap-6 border-b border-border pb-8 lg:grid-cols-[1fr_340px]">
        <div>
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            Engine Workspace
          </p>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold md:text-5xl">
            Build SwordWeave from atomic rules to playable cards.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
            The current foundation starts with primitives, then grows into
            effects, capabilities, ledgers, and shared JSON packages without
            splitting the rule engine into separate systems.
          </p>
        </div>

        <div className="grid content-start gap-3 rounded-md border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold">Exchange Format</p>
            <div className="flex gap-2 text-muted-foreground">
              <Upload className="size-4" />
              <Download className="size-4" />
            </div>
          </div>
          <p className="text-sm leading-6 text-muted-foreground">
            Import/export should be versioned JSON packages. We will start with
            primitives, then reuse the same envelope for effects, capabilities,
            characters, items, monsters, and templates.
          </p>
          <code className="rounded-md border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
            swordweave.package.v1
          </code>
        </div>
      </section>

      <section className="grid gap-4 py-8 md:grid-cols-2 xl:grid-cols-4">
        {workspaces.map((workspace) => {
          const Icon = workspace.icon;

          return (
            <Link
              className="group flex min-h-56 flex-col rounded-md border border-border bg-card p-5 transition-colors hover:border-primary"
              href={workspace.href}
              key={workspace.href}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex size-10 items-center justify-center rounded-md border border-border bg-background">
                  <Icon className="size-5 text-primary" />
                </div>
                <span className="rounded-sm bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground">
                  {workspace.label}
                </span>
              </div>
              <h2 className="mt-5 text-lg font-semibold">{workspace.title}</h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {workspace.description}
              </p>
              <span className="mt-auto flex items-center gap-2 pt-5 text-sm font-medium text-primary">
                Open
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
              </span>
            </Link>
          );
        })}
      </section>
    </div>
  );
}
