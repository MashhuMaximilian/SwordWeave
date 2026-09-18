import { redirect } from "next/navigation";
import { and, asc, desc, eq, or, isNull } from "drizzle-orm";
import Link from "next/link";
import { Hammer, Plus } from "lucide-react";
import { auth, currentUser } from "@clerk/nextjs/server";
import { NewCharacterButton } from "@/components/characters/new-character-button";
import { db } from "@/db/client";
import {
  builds,
  capabilities,
  characters,
  effects,
  items,
  primitives,
  heritage,
  publications,
} from "@/db/schema";
import {
  buildToLibraryItem,
  capabilityToLibraryItem,
  characterToLibraryItem,
  effectToLibraryItem,
  itemToLibraryItem,
  primitiveToLibraryItem,
  heritageToLibraryItem,
} from "@/components/sandbox/sandbox-row-mapper";
import type { LibraryItem } from "@/lib/publishing/library-query";
import { CreationsClient } from "./creations-client";
import { resolveLocalAuthorIdentity } from "@/lib/auth/author-resolver";
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
  const clerkAccount = await currentUser();
  const ownerIdentity = await resolveLocalAuthorIdentity(
    userId,
    clerkAccount?.username,
  );
  const ownerClerkId = ownerIdentity.clerkUserId;

  const params = await searchParams;
  const statusFilter = params.status === "draft" ? "draft" : "all";

  // "My creations" = rows the user authored. We pull all entity types in
  // parallel and let the client filter by type/status. Drafts = private
  // (isPublic=false); Published = public.
  const [primitiveRows, effectRows, capabilityRows, templateRows, itemRows, characterRows, buildRows] =
    await Promise.all([
      db.query.primitives.findMany({
        where: eq(primitives.userId, ownerClerkId),
        orderBy: [asc(primitives.name)],
      }),
      db.query.effects.findMany({
        where: eq(effects.userId, ownerClerkId),
        orderBy: [asc(effects.name)],
        with: { primitiveLinks: { with: { primitive: true } } },
      }),
      db.query.capabilities.findMany({
        where: eq(capabilities.userId, ownerClerkId),
        orderBy: [asc(capabilities.name)],
        with: { primitiveLinks: { with: { primitive: true } } },
      }),
      db.query.heritage.findMany({
        where: eq(heritage.userId, ownerClerkId),
        orderBy: [asc(heritage.kind), asc(heritage.name)],
      }),
      db.query.items.findMany({
        where: eq(items.userId, ownerClerkId),
        orderBy: [asc(items.name)],
      }),
      db.query.characters.findMany({
        where: eq(characters.userId, ownerClerkId),
        orderBy: [desc(characters.level), asc(characters.name)],
      }),
      // Builds (Phase 7): separate `builds` table. Same ownership model —
      // userId is the Clerk ID string, same as the other tables — so the
      // "My creations" filter is a single equality on text. Without this
      // row users couldn't see or edit their own builds from /creations.
      db.query.builds.findMany({
        columns: { id: true, name: true, description: true, level: true,
          isPublic: true, sourceOrigin: true, iconSource: true, iconKey: true,
          iconUrl: true, iconColor: true },
        where: eq(builds.userId, ownerClerkId),
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
        r.kind === "LINEAGE"
          ? ("LINEAGE_TEMPLATE" as const)
          : r.kind === "UPBRINGING"
            ? ("UPBRINGING_TEMPLATE" as const)
            : ("MANIFEST_TEMPLATE" as const),
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
  const currentUserInternalId = ownerIdentity.internalUserId;

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
        r.kind === "LINEAGE"
          ? "LINEAGE_TEMPLATE"
          : r.kind === "UPBRINGING"
            ? "UPBRINGING_TEMPLATE"
            : "MANIFEST_TEMPLATE";
      return heritageToLibraryItem(r, visFor(t, r.id));
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
    <main className="v12-creations-page">
      <div className="v12-creations-hero">
        <div>
          <p className="v12-kicker">
            Workshop
          </p>
          <h1>
            <Hammer className="size-8" />
            My Creations
          </h1>
          <p className="v12-creations-deck">
            All your authored entries — primitives, effects, capabilities,
            heritage, and items — in one place. Filter by type or status to
            find drafts, jump into the sandbox to keep editing, or open the
            canonical detail page to view forks and likes.
          </p>
        </div>
        <div className="v12-creations-actions">
          <Link
            href="/atelier?build=primitive"
            className="v12-metal-button v12-metal-button--primary"
          >
            <Plus className="size-4" /> New Grammar
          </Link>
          <Link
            href="/atelier?build=heritage"
            className="v12-metal-button"
          >
            <Plus className="size-4" /> New Heritage
          </Link>
          <NewCharacterButton variant="outline" />
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
    </main>
  );
}
