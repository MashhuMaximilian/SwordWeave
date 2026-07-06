import { redirect } from "next/navigation";
import { and, asc, desc, eq, or, isNull } from "drizzle-orm";
import Link from "next/link";
import { Hammer, Plus } from "lucide-react";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/client";
import {
  capabilities,
  effects,
  items,
  primitives,
  templates,
} from "@/db/schema";
import {
  capabilityToLibraryItem,
  effectToLibraryItem,
  itemToLibraryItem,
  primitiveToLibraryItem,
  templateToLibraryItem,
} from "@/components/sandbox/sandbox-row-mapper";
import type { LibraryItem } from "@/lib/publishing/library-query";
import { CreationsClient } from "./creations-client";

export const dynamic = "force-dynamic";

export default async function CreationsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; status?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in?redirect=/creations");
  }

  const params = await searchParams;
  const statusFilter = params.status === "draft" ? "draft" : "all";

  // "My creations" = rows the user authored. We pull all entity types in
  // parallel and let the client filter by type/status. Drafts = private
  // (isPublic=false); Published = public.
  const [primitiveRows, effectRows, capabilityRows, templateRows, itemRows] =
    await Promise.all([
      db.query.primitives.findMany({
        where: eq(primitives.userId, userId),
        orderBy: [asc(primitives.name)],
      }),
      db.query.effects.findMany({
        where: eq(effects.userId, userId),
        orderBy: [asc(effects.name)],
        with: { primitiveLinks: { with: { primitive: true } } },
      }),
      db.query.capabilities.findMany({
        where: eq(capabilities.userId, userId),
        orderBy: [asc(capabilities.name)],
        with: { primitiveLinks: { with: { primitive: true } } },
      }),
      db.query.templates.findMany({
        where: eq(templates.userId, userId),
        orderBy: [asc(templates.kind), asc(templates.name)],
      }),
      db.query.items.findMany({
        where: eq(items.userId, userId),
        orderBy: [asc(items.name)],
      }),
    ]);

  const allItems: LibraryItem[] = [
    ...primitiveRows.map(primitiveToLibraryItem),
    ...effectRows.map(effectToLibraryItem),
    ...capabilityRows.map(capabilityToLibraryItem),
    ...templateRows.map(templateToLibraryItem),
    ...itemRows.map(itemToLibraryItem),
  ];

  const counts = {
    primitive: primitiveRows.length,
    effect: effectRows.length,
    capability: capabilityRows.length,
    template: templateRows.length,
    item: itemRows.length,
    character: 0, // characters live in /characters
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            Workshop
          </p>
          <h1 className="mt-3 flex items-center gap-2 text-4xl font-semibold">
            <Hammer className="size-8" />
            My Creations
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
            All your authored entries — primitives, effects, capabilities,
            templates, and items — in one place. Filter by type or status to
            find drafts, jump into the sandbox to keep editing, or open the
            canonical detail page to view forks and likes.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Link
            href="/sandbox/grammar?build=primitive"
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="size-4" /> New Grammar
          </Link>
          <Link
            href="/sandbox/blueprint?build=template"
            className="flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:border-primary"
          >
            <Plus className="size-4" /> New Template
          </Link>
          <Link
            href="/sandbox/characters"
            className="flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:border-primary"
          >
            <Plus className="size-4" /> New Character
          </Link>
        </div>
      </div>

      <CreationsClient
        items={allItems}
        counts={counts}
        initialType={params.type ?? "all"}
        initialStatus={statusFilter}
      />
    </div>
  );
}
