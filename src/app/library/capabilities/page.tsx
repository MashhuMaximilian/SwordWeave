import { asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { db } from "@/db/client";
import {
  capabilities,
  capabilityPrimitives,
  primitives,
} from "@/db/schema";
import { LibraryCapabilitiesView } from "@/components/library/library-capabilities-view";

export const dynamic = "force-dynamic";

export default async function LibraryCapabilitiesPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    type?: string;
    source?: string;
    sort?: string;
  }>;
}) {
  const params = await searchParams;
  const query = (params.q ?? "").trim();
  const typeFilter = params.type ?? "ALL";
  const sourceFilter = params.source ?? "ALL";
  const sortBy = params.sort ?? "name";

  // Build where conditions
  const conditions = [eq(capabilities.isPublic, true)];

  if (query) {
    conditions.push(
      or(
        ilike(capabilities.name, `%${query}%`),
        ilike(capabilities.verboseDescription, `%${query}%`),
      )!,
    );
  }

  if (typeFilter !== "ALL") {
    conditions.push(
      eq(capabilities.type, typeFilter as "ACTIVE" | "PASSIVE" | "AUGMENT"),
    );
  }

  const orderBy =
    sortBy === "date"
      ? [desc(capabilities.createdAt), asc(capabilities.name)]
      : sortBy === "bu"
        ? [asc(capabilities.name)] // we'll sort by BU client-side after computing
        : [asc(capabilities.name)];

  const capRows = await db.query.capabilities.findMany({
    where: conditions.length > 0 ? sql.join(conditions, sql` AND `) : undefined,
    orderBy,
    with: {
      primitiveLinks: {
        orderBy: [asc(capabilityPrimitives.sortOrder)],
        with: {
          primitive: true,
        },
      },
    },
  });

  // Load all primitives once for source-filter and BU computation
  const allPrimitives = await db.query.primitives.findMany({
    orderBy: [asc(primitives.name)],
  });

  // Compute BU total for each capability
  const capabilitiesWithBu = capRows.map((cap) => {
    const bu = cap.primitiveLinks.reduce(
      (total, link) =>
        total + (link.primitive?.buCost ?? 0) * link.quantity,
      0,
    );
    return { ...cap, computedBu: bu };
  });

  // Apply source filter
  let filtered = capabilitiesWithBu;
  if (sourceFilter !== "ALL") {
    filtered = filtered.filter((c) => c.sourceType === sourceFilter);
  }

  // Apply BU sort
  if (sortBy === "bu") {
    filtered.sort((a, b) => b.computedBu - a.computedBu);
  }

  // Serialize for client component
  const serialized = filtered.map((cap) => ({
    id: cap.id,
    name: cap.name,
    type: cap.type,
    sourceType: cap.sourceType,
    verboseDescription: cap.verboseDescription,
    sourceOrigin: cap.sourceOrigin,
    tags: cap.tags,
    isPublic: cap.isPublic,
    computedBu: cap.computedBu,
    primitiveCount: cap.primitiveLinks.length,
    primitiveNames: cap.primitiveLinks
      .map((link) => link.primitive?.name ?? null)
      .filter((n): n is string => n !== null),
  }));

  // Get unique source origins for the filter
  const allOrigins = Array.from(
    new Set(capRows.map((c) => c.sourceOrigin).filter(Boolean)),
  ) as string[];

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
        {serialized.length} of {capRows.length} public capabilities
      </p>

      <LibraryCapabilitiesView
        capabilities={serialized}
        allPrimitives={allPrimitives.map((p) => ({
          id: p.id,
          name: p.name,
          category: p.category,
          buCost: p.buCost,
        }))}
        currentFilters={{
          q: query,
          type: typeFilter,
          source: sourceFilter,
          sort: sortBy,
        }}
        allOrigins={allOrigins}
      />
    </div>
  );
}