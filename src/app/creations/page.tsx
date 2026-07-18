import { redirect } from "next/navigation";
import { and, asc, desc, eq, or, isNull } from "drizzle-orm";
import Link from "next/link";
import { Hammer, Plus } from "lucide-react";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/client";
import {
  builds,
  capabilities,
  characters,
  effects,
  items,
  primitives,
  templates,
  publications,
} from "@/db/schema";
import {
  buildToLibraryItem,
  capabilityToLibraryItem,
  characterToLibraryItem,
  effectToLibraryItem,
  itemToLibraryItem,
  primitiveToLibraryItem,
  templateToLibraryItem,
} from "@/components/sandbox/sandbox-row-mapper";
import type { LibraryItem } from "@/lib/publishing/library-query";
import { CreationsClient } from "./creations-client";
import { resolveUserIdByClerkId } from "@/lib/auth/author-resolver";
import { loadLibraryEngagement } from "@/lib/engagement/library-engagement";
import {
  resolveEngagementMap,
  enrichItemsWithEngagement,
} from "@/lib/engagement/engagement-aggregates";

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
  const [primitiveRows, effectRows, capabilityRows, templateRows, itemRows, characterRows, buildRows] =
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
      db.query.characters.findMany({
        where: eq(characters.userId, userId),
        orderBy: [desc(characters.level), asc(characters.name)],
      }),
      // Builds (Phase 7): separate `builds` table. Same ownership model —
      // userId is the Clerk ID string, same as the other tables — so the
      // "My creations" filter is a single equality on text. Without this
      // row users couldn't see or edit their own builds from /creations.
      db.query.builds.findMany({
        where: eq(builds.userId, userId),
        orderBy: [desc(builds.level), asc(builds.name)],
      }),
    ]);

  // Look up publication rows for every (targetType, targetId) the user
  // owns, in one query. Used to show the per-item visibility badge and to
  // give the client a starting value for the visibility selector.
  const allTargetKeys = [
    ...primitiveRows.map((r) => ({ type: "PRIMITIVE" as const, id: String(r.id) })),
    ...effectRows.map((r) => ({ type: "EFFECT" as const, id: r.id })),
    ...capabilityRows.map((r) => ({ type: "CAPABILITY" as const, id: r.id })),
    ...templateRows.map((r) => ({
      type:
        r.kind === "RACE"
          ? ("RACE_TEMPLATE" as const)
          : r.kind === "BACKGROUND"
            ? ("BACKGROUND_TEMPLATE" as const)
            : ("ARCHETYPE_TEMPLATE" as const),
      id: r.id,
    })),
    ...itemRows.map((r) => ({ type: "ITEM" as const, id: r.id })),
    ...characterRows.map((r) => ({ type: "CHARACTER" as const, id: r.id })),
    ...buildRows.map((r) => ({ type: "BUILD_TEMPLATE" as const, id: r.id })),
  ];
  // Bulk fetch the latest publication per (target_type, target_id) using
  // a single IN query, then index by the composite key. Anything missing
  // from the result is "PRIVATE" (no publication row).
  const pubRows = allTargetKeys.length
    ? await db
        .select()
        .from(publications)
        .where(
          or(
            ...allTargetKeys.map((k) =>
              and(
                eq(publications.targetType, k.type as never),
                eq(publications.targetId, k.id),
              ),
            ),
          ),
        )
    : [];
  const visByKey = new Map<string, "PUBLIC" | "FOLLOWERS_ONLY" | "PRIVATE">();
  for (const r of pubRows) {
    if (r.unpublishedAt) continue;
    visByKey.set(`${r.targetType}:${r.targetId}`, r.visibility);
  }

  const visFor = (type: string, id: string) =>
    visByKey.get(`${type}:${id}`) ?? "PRIVATE";

  // Resolve the current user's internal UUID so we can attach the user's
  // own reaction state to each card (the LikeForkBar needs this to show
  // the right "active" icon when the user has already liked the entry).
  // Without it, the creations list renders an empty heart on every card
  // and clicking it would prompt a sign-in modal even when authed.
  const currentUserInternalId = await resolveUserIdByClerkId(userId);

  // Build items WITHOUT engagement first so we can resolve the engagement
  // map keyed by the same composite IDs the mappers emit
  // (`<TYPE>:<id>`). LibraryItem `authorId` is always the current user on
  // this page (we filter by userId above), so the follow bar is hidden.
  const baseItems: LibraryItem[] = [
    ...primitiveRows.map((r) => primitiveToLibraryItem(r, visFor("PRIMITIVE", String(r.id)))),
    ...effectRows.map((r) => effectToLibraryItem(r, visFor("EFFECT", r.id))),
    ...capabilityRows.map((r) => capabilityToLibraryItem(r, visFor("CAPABILITY", r.id))),
    ...templateRows.map((r) => {
      const t =
        r.kind === "RACE"
          ? "RACE_TEMPLATE"
          : r.kind === "BACKGROUND"
            ? "BACKGROUND_TEMPLATE"
            : "ARCHETYPE_TEMPLATE";
      return templateToLibraryItem(r, visFor(t, r.id));
    }),
    ...itemRows.map((r) => itemToLibraryItem(r, visFor("ITEM", r.id))),
    ...characterRows.map((r) => characterToLibraryItem(r, visFor("CHARACTER", r.id))),
    ...buildRows.map((r) => buildToLibraryItem(r, visFor("BUILD_TEMPLATE", r.id))),
  ];

  // Fetch engagement state for the user AND the count aggregates in
  // parallel. Both depend on baseItems (for IDs + author IDs) but
  // don't depend on each other.
  const [engagement, engagementCounts] = await Promise.all([
    loadLibraryEngagement(
      currentUserInternalId,
      baseItems.map((it) => ({
        id: it.id,
        targetType: it.targetType,
        targetId: it.targetId,
        authorId: it.authorId,
      })),
    ),
    resolveEngagementMap(baseItems.map((it) => it.id)),
  ]);

  const allItems: LibraryItem[] = enrichItemsWithEngagement(
    baseItems,
    engagementCounts,
  );

  const counts = {
    primitive: primitiveRows.length,
    effect: effectRows.length,
    capability: capabilityRows.length,
    template: templateRows.length,
    item: itemRows.length,
    character: characterRows.length,
    build: buildRows.length,
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
            href="/atelier?build=primitive"
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="size-4" /> New Grammar
          </Link>
          <Link
            href="/atelier?build=template"
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
        engagement={engagement}
        currentUserInternalId={currentUserInternalId}
      />
    </div>
  );
}
