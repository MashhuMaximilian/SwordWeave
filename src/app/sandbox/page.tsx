import Link from "next/link";
import { ArrowRight, Boxes, FlaskConical, Swords } from "lucide-react";

const workshops = [
  {
    href: "/sandbox/primitives",
    title: "Primitives",
    status: "Live",
    description:
      "Author atomic BU records, hard modifier directives, and mirrorable drawbacks.",
    icon: Boxes,
  },
  {
    href: "/sandbox/effects",
    title: "Effects",
    status: "Next",
    description:
      "Group primitives into reusable named states, conditions, and rule packages.",
    icon: FlaskConical,
  },
  {
    href: "/sandbox/capabilities",
    title: "Capabilities",
    status: "Planned",
    description:
      "Compile verbs, domains, ranges, and effects into tactical action cards.",
    icon: Swords,
  },
] as const;

export default function SandboxPage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-8">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold uppercase text-muted-foreground">
          Unified Sandbox
        </p>
        <h1 className="mt-3 text-4xl font-semibold">
          Build the grammar before the sheet.
        </h1>
        <p className="mt-4 text-base leading-7 text-muted-foreground">
          The sandbox is the accounts-free design bench where SwordWeave objects
          are assembled from primitives upward.
        </p>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        {workshops.map((workshop) => {
          const Icon = workshop.icon;

          return (
            <Link
              className="group flex min-h-64 flex-col rounded-md border border-border bg-card p-5 transition-colors hover:border-primary"
              href={workshop.href}
              key={workshop.href}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex size-10 items-center justify-center rounded-md border border-border bg-background">
                  <Icon className="size-5 text-primary" />
                </div>
                <span className="rounded-sm bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground">
                  {workshop.status}
                </span>
              </div>
              <h2 className="mt-5 text-xl font-semibold">{workshop.title}</h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {workshop.description}
              </p>
              <span className="mt-auto flex items-center gap-2 pt-6 text-sm font-medium text-primary">
                Open workshop
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
