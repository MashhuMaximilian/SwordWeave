import { asc, desc } from "drizzle-orm";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { db } from "@/db/client";
import {
  capabilities,
  capabilityPrimitives,
  primitives,
} from "@/db/schema";

export const dynamic = "force-dynamic";

export default async function LibraryCapabilitiesPage() {
  const [capRows, primRows] = await Promise.all([
    db.query.capabilities.findMany({
      where: (table, { eq }) => eq(table.isPublic, true),
      orderBy: [desc(capabilities.createdAt), asc(capabilities.name)],
      with: {
        primitiveLinks: {
          orderBy: [asc(capabilityPrimitives.sortOrder)],
          with: {
            primitive: true,
          },
        },
      },
    }),
    db.query.primitives.findMany({
      orderBy: [asc(primitives.name)],
    }),
  ]);

  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-8">
      <Link
        href="/library"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Library Hub
      </Link>

      <h1 className="mt-4 text-4xl font-semibold">Capabilities</h1>
      <p className="mt-2 text-base text-muted-foreground">
        {capRows.length} public capabilities compiled from primitives.
      </p>

      <div className="mt-8 grid gap-3 md:grid-cols-2">
        {capRows.map((cap) => {
          const bu = cap.primitiveLinks.reduce(
            (total, link) =>
              total + (link.primitive?.buCost ?? 0) * link.quantity,
            0,
          );
          return (
            <article
              key={cap.id}
              className="rounded-md border border-border bg-card p-4"
            >
              <header className="flex items-start justify-between gap-2">
                <h3 className="font-semibold">{cap.name}</h3>
                <span className="shrink-0 rounded-full bg-primary/10 px-2 py-1 font-mono text-xs font-semibold text-primary">
                  {bu} BU
                </span>
              </header>
              <p className="mt-1 text-xs text-muted-foreground">
                {cap.type} - {cap.sourceType}
                {cap.sourceOrigin ? ` - ${cap.sourceOrigin}` : ""}
              </p>
              <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">
                {cap.verboseDescription}
              </p>

              {cap.primitiveLinks.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {cap.primitiveLinks.map((link, i) => (
                    <span
                      key={`${link.primitiveId}-${i}`}
                      className="rounded-full bg-secondary px-2 py-0.5 text-xs"
                    >
                      {link.primitive?.name ?? `prim#${link.primitiveId}`} ({link.role})
                    </span>
                  ))}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}