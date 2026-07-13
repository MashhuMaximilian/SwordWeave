// =============================================================================
// /library/item/[id] — public detail view for a library item
// id format: `<type>:<id>` e.g. "PRIMITIVE:42", "CAPABILITY:abc-uuid",
//            "RACE_TEMPLATE:def-uuid"
//
// Phase 5: wires up engagement data (likes/dislikes/forks), the current
// user's reaction state, and the author → follow relationship. Markdown is
// rendered for description fields via react-markdown.
// =============================================================================

import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { ArrowLeft, ChevronRight, Pencil, User as UserIcon } from "lucide-react";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  forkAggregates,
  reactionAggregates,
  reactions,
} from "@/db/schema";
import { LikeForkBar } from "@/components/engagement/like-fork-bar";
import { ForksList } from "@/components/engagement/forks-list";
import { FlagAndForkFooter } from "@/components/engagement/flag-and-fork-footer";
import type { ForkTargetType } from "@/lib/publishing/forks-query";
import { Markdown } from "@/components/ui/markdown";
import { IconDisplay } from "@/components/icons/icon-display";
import {
  resolveAuthorByClerkId,
  resolveUserIdByClerkId,
} from "@/lib/auth/author-resolver";
import { resolveVirtualVersionId } from "@/lib/engagement/version-helpers";
import {
  getFlagAggregate,
  listFlagNotes,
  type FlagReason,
} from "@/lib/engagement/flags-service";
import { getForkSource } from "@/lib/publishing/fork-lineage";
import { checkVisibility } from "@/lib/publishing/visibility";
import {
  bulkResolveLatestVersionNumbers,
  type VersionNumberKey,
} from "@/lib/versions/bulk-resolve-latest-version-numbers";
import {
  bulkComputeEffectBuCost,
  bulkComputeCapabilityBuCost,
} from "@/lib/versions/bulk-compute-bu-cost";

export const dynamic = "force-dynamic";
export const revalidate = 0;
// The page queries Neon Postgres via @neondatabase/serverless, which needs
// the Node.js runtime (Pool uses ws + crypto). Without this, Vercel may
// pick the edge runtime for this route, where `process` is not a global
// and DATABASE_URL ends up undefined → "DATABASE_URL is required" error.
export const runtime = "nodejs";

interface PageProps {
  params: Promise<{ id: string }>;
}

function parseCompositeId(raw: string): {
  type: string;
  id: string;
} | null {
  const idx = raw.indexOf(":");
  if (idx < 1) return null;
  return { type: raw.slice(0, idx), id: raw.slice(idx + 1) };
}

interface EngagementData {
  likes: number;
  dislikes: number;
  forks: number;
  net: number;
  userReaction: "LIKE" | "DISLIKE" | null;
}

async function loadEngagement(
  targetType: string,
  targetId: string,
  currentUserInternalId: string | null,
): Promise<EngagementData> {
  // Default empty state — any failure below returns this so the page
  // degrades gracefully instead of throwing a 500.
  const empty: EngagementData = {
    likes: 0,
    dislikes: 0,
    forks: 0,
    net: 0,
    userReaction: null,
  };

  let versionId: string;
  try {
    versionId = resolveVirtualVersionId(
      targetType as never,
      targetId,
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[library item page] resolveVirtualVersionId failed:", err);
    return empty;
  }

  try {
  const [rxAgg, fkAgg, userRx] = await Promise.all([
    db
      .select({
        likes: sql<number>`SUM(${reactionAggregates.likesCount})::int`,
        dislikes: sql<number>`SUM(${reactionAggregates.dislikesCount})::int`,
      })
      .from(reactionAggregates)
      .where(
        and(
          eq(reactionAggregates.targetType, targetType as never),
          eq(reactionAggregates.targetId, targetId),
        ),
      )
      .then((r) => ({
        likes: Number(r[0]?.likes ?? 0),
        dislikes: Number(r[0]?.dislikes ?? 0),
      })),
    db
      .select({
        count: sql<number>`SUM(${forkAggregates.forkCount})::int`,
      })
      .from(forkAggregates)
      .where(
        and(
          eq(forkAggregates.sourceTargetType, targetType as never),
          eq(forkAggregates.sourceTargetId, targetId),
        ),
      )
      .then((r) => Number(r[0]?.count ?? 0)),
    currentUserInternalId
      ? db
          .select({ kind: reactions.kind })
          .from(reactions)
          .where(
            and(
              eq(reactions.userId, currentUserInternalId),
              eq(reactions.targetType, targetType as never),
              eq(reactions.targetId, targetId),
              eq(reactions.versionId, versionId),
            ),
          )
          .then((r) => r[0]?.kind ?? null)
      : Promise.resolve(null),
  ]);

  return {
    likes: rxAgg.likes,
    dislikes: rxAgg.dislikes,
    forks: fkAgg,
    net: rxAgg.likes - rxAgg.dislikes,
    userReaction: userRx as "LIKE" | "DISLIKE" | null,
  };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[library item page] engagement load failed, returning empty:", err);
    return empty;
  }
}
// =============================================================================
// loadFlagsAndTags — Source-page footer data (flags + tag chips).
//
// Runs the flag-distribution + OTHER-notes fetch in parallel. Both are
// indexed lookups against (targetType, targetId) so they're cheap, but
// the await chain is sequential by default — parallelizing shaves ~50ms
// off the source-page TTI.
//
// Wrapped in try/catch so a transient failure on the flag tables doesn't
// 500 the entire source page — both come back as empty defaults, the
// footer just doesn't render the section.
// =============================================================================

async function loadFlagsAndTags(
  targetType: string,
  targetId: string,
  tags: string[],
): Promise<{
  flagDistribution: Record<FlagReason, number>;
  flagNotes: Array<{ id: string; note: string; reportedAt: Date | string }>;
}> {
  // Fallback for targets without a real versionId (shouldn't happen for
  // published items, but defense-in-depth).
  let versionId: string;
  try {
    versionId = resolveVirtualVersionId(
      targetType as never,
      targetId,
    );
  } catch {
    return {
      flagDistribution: {
        UNBALANCED: 0,
        BROKEN: 0,
        INAPPROPRIATE: 0,
        DUPLICATE: 0,
        OTHER: 0,
      },
      flagNotes: [],
    };
  }

  try {
    const [distribution, notes] = await Promise.all([
      getFlagAggregate(targetType as never, targetId, versionId),
      // Only fetch notes when there's something to show. Saves a DB
      // round-trip on items that have zero flags. Note: this only
      // saves when `notes.length` would be 0 — we still issue the
      // query when there ARE OTHER notes, but in that case we'd want
      // them anyway.
      listFlagNotes(targetType as never, targetId, versionId).then(
        (rows) =>
          rows.map((r) => ({
            id: r.id,
            note: r.note,
            // Date → ISO string so it survives serialization to the
            // client component. The modal re-parses with new Date().
            reportedAt:
              r.reportedAt instanceof Date
                ? r.reportedAt.toISOString()
                : r.reportedAt,
          })),
      ),
    ]);

    // We asked for the notes regardless of count, but we can still
    // short-circuit the list when nothing came back. Tags are passed
    // through unchanged.
    void tags;
    return {
      flagDistribution: distribution,
      flagNotes: notes,
    };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(
      "[library item page] flag/tag load failed, returning empty:",
      err,
    );
    return {
      flagDistribution: {
        UNBALANCED: 0,
        BROKEN: 0,
        INAPPROPRIATE: 0,
        DUPLICATE: 0,
        OTHER: 0,
      },
      flagNotes: [],
    };
  }
}

// =============================================================================
// loadForkSource — single query for the immediate parent of a fork.
//
// Fail-soft: returns null on any error so the source page just hides
// the "Forked from" section rather than 500-ing.
// =============================================================================

async function loadForkSource(
  targetType: string,
  targetId: string,
): Promise<{
  sourceTargetType: string;
  sourceTargetId: string;
  sourceAuthorUsername: string | null;
  forkedAt: Date | string;
} | null> {
  try {
    const src = await getForkSource(
      targetType as never,
      targetId,
    );
    if (!src) return null;
    return {
      sourceTargetType: src.sourceTargetType,
      sourceTargetId: src.sourceTargetId,
      sourceAuthorUsername: src.sourceAuthorUsername,
      forkedAt:
        src.forkedAt instanceof Date
          ? src.forkedAt.toISOString()
          : src.forkedAt,
    };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[library item page] forkSource load failed:", err);
    return null;
  }
}

export default async function LibraryItemPage({ params }: PageProps) {
  const { id: rawId } = await params;
  const parsed = parseCompositeId(decodeURIComponent(rawId));
  if (!parsed) notFound();

  const { type, id } = parsed;

  // Resolve current user (Clerk auth) once
  const { userId: clerkUserId } = await auth();
  const currentUserInternalId = clerkUserId
    ? await resolveUserIdByClerkId(clerkUserId)
    : null;

  if (type === "PRIMITIVE") {
    const numericId = Number(id);
    if (!Number.isFinite(numericId)) notFound();
    return (
      <PrimitiveDetail
        id={numericId}
        currentUserId={currentUserInternalId}
        viewerClerkId={clerkUserId}
      />
    );
  }
  if (type === "CAPABILITY") {
    return (
      <CapabilityDetail
        id={id}
        currentUserId={currentUserInternalId}
        viewerClerkId={clerkUserId}
      />
    );
  }
  if (
    type === "RACE_TEMPLATE" ||
    type === "BACKGROUND_TEMPLATE" ||
    type === "ARCHETYPE_TEMPLATE"
  ) {
    return (
      <TemplateDetail
        id={id}
        currentUserId={currentUserInternalId}
        viewerClerkId={clerkUserId}
      />
    );
  }
  if (type === "EFFECT") {
    return (
      <EffectDetail
        id={id}
        currentUserId={currentUserInternalId}
        viewerClerkId={clerkUserId}
      />
    );
  }
  if (type === "ITEM") {
    return (
      <ItemDetail
        id={id}
        currentUserId={currentUserInternalId}
        viewerClerkId={clerkUserId}
      />
    );
  }
  notFound();
}

interface DetailProps {
  currentUserId: string | null;
  viewerClerkId: string | null;
}

function DetailShell({
  children,
  backHref,
  typeLabel,
  name,
  buCost,
  category,
  description,
  author,
  ownerId,
  editHref,
  targetType,
  targetId,
  engagement,
  currentUserId,
  tags,
  flagDistribution,
  flagNotes,
  forkSource,
  // Phase 8: per-entity iconography. All optional — if absent, the
  // header falls back to a "kind" placeholder.
  iconSource,
  iconKey,
  iconUrl,
  iconColor,
}: {
  children: React.ReactNode;
  backHref: string;
  typeLabel: string;
  name: string;
  buCost: number | null;
  category: string | null;
  description: string | null;
  author: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  } | null;
  /**
   * Clerk userId of the row's creator. Use this (not `author.id`) for
   * ownership checks because `author` may resolve to null when the row has
   * no public profile (e.g. system-published items with no User row).
   */
  ownerId: string | null;
  /**
   * URL to the sandbox editor for this row. Only rendered when the viewer
   * is the owner (ownerId === currentUserId). Pass null for read-only
   * entity types (e.g. builds that are loaded through library as a view).
   */
  editHref: string | null;
  targetType: string;
  targetId: string;
  engagement: EngagementData;
  currentUserId: string | null;
  /**
   * Tag chips to render above the Flags section. Empty array hides
   * the row entirely.
   */
  tags: string[];
  /**
   * Per-reason flag counts. The Flags section only renders when
   * the sum is > 0 — a "Flags (0)" pill is noise.
   */
  flagDistribution: {
    UNBALANCED: number;
    BROKEN: number;
    INAPPROPRIATE: number;
    DUPLICATE: number;
    OTHER: number;
  };
  /**
   * OTHER-reason notes for the modal. Empty array is fine — the modal
   * just shows "No freeform notes yet." inside.
   */
  flagNotes: Array<{ id: string; note: string; reportedAt: Date | string }>;
  /**
   * Immediate parent fork (if this entity was forked from another).
   * Null = this is the original / hasn't been forked from. The footer
   * collapses the "Forked from" section when null.
   */
  forkSource: {
    sourceTargetType: string;
    sourceTargetId: string;
    sourceAuthorUsername: string | null;
    forkedAt: Date | string;
  } | null;
  // Phase 8: per-entity iconography
  iconSource?: "GAME_ICONS" | "UPLOAD" | null;
  iconKey?: string | null;
  iconUrl?: string | null;
  iconColor?: string | null;
}) {
  const canEdit =
    editHref !== null &&
    ownerId !== null &&
    currentUserId !== null &&
    ownerId === currentUserId;
  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-8">
      <Link
        href={backHref}
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> Back to library
      </Link>

      <article className="rounded-md border border-border bg-card p-6">
        <header className="border-b border-border pb-4">
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            {typeLabel}
            {category ? ` · ${category.replace(/_/g, " ")}` : ""}
          </p>
          <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              {/* Phase 8: entity icon in the detail header. */}
              {iconSource ? (
                <IconDisplay
                  iconSource={iconSource}
                  iconKey={iconKey ?? null}
                  iconUrl={iconUrl ?? null}
                  iconColor={iconColor ?? "#ffffff"}
                  size={56}
                  className="rounded-md border border-border"
                  alt={name}
                />
              ) : (
                <div
                  aria-hidden="true"
                  className="flex size-14 items-center justify-center rounded-md border border-dashed border-border bg-muted/30 text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
                >
                  {typeLabel.split(" ")[0]?.slice(0, 3) ?? "?"}
                </div>
              )}
              <h1 className="font-display break-words text-3xl font-semibold uppercase tracking-wide">{name}</h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {buCost !== null && (
                <span className="rounded-full bg-primary/10 px-3 py-1 font-mono text-sm font-semibold text-primary">
                  {buCost} BU
                </span>
              )}
              {canEdit && (
                <Link
                  href={editHref!}
                  className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                  title="You own this — edit in your sandbox"
                >
                  <Pencil className="size-3.5" />
                  Edit in sandbox
                </Link>
              )}
            </div>
          </div>
          {author && (
            <Link
              href={`/u/${author.username}`}
              className="mt-3 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              {author.avatarUrl ? (
                <img
                  src={author.avatarUrl}
                  alt=""
                  className="size-5 rounded-full"
                />
              ) : (
                <UserIcon className="size-4" />
              )}
              by{" "}
              <span className="font-semibold">
                {author.displayName ?? author.username}
              </span>
            </Link>
          )}
        </header>

        {description && (
          <section className="mt-5">
            <h2 className="mb-2 text-sm font-semibold uppercase text-muted-foreground">
              Description
            </h2>
            <div className="prose prose-invert prose-sm max-w-none break-words text-sm leading-7">
              <Markdown>{description}</Markdown>
            </div>
          </section>
        )}

        <div className="mt-5">{children}</div>

        <footer className="mt-6 border-t border-border pt-4">
          <LikeForkBar
            targetType={
              targetType as
                | "PRIMITIVE"
                | "CAPABILITY"
                | "CHARACTER"
                | "ITEM"
                | "RACE_TEMPLATE"
                | "BACKGROUND_TEMPLATE"
                | "ARCHETYPE_TEMPLATE"
            }
            targetId={targetId}
            initialLikes={engagement.likes}
            initialDislikes={engagement.dislikes}
            initialForks={engagement.forks}
            initialUserReaction={engagement.userReaction}
            authorId={author?.id ?? null}
            authorUsername={author?.username ?? null}
            currentUserId={currentUserId}
          />
          <FlagAndForkFooter
            targetType={targetType}
            targetId={targetId}
            forksTargetType={targetType as ForkTargetType}
            tags={tags}
            flagDistribution={flagDistribution}
            flagNotes={flagNotes}
            forkSource={forkSource}
          />
          {/* ForksList rendered as a sibling (server component) — cannot be
              a child of <FlagAndForkFooter> because that's a "use client"
              component and would inline the DB query into the browser
              bundle, throwing DATABASE_URL at hydration time. */}
          <div className="mt-5">
            <ForksList
              targetType={targetType as ForkTargetType}
              targetId={targetId}
            />
          </div>
        </footer>
      </article>
    </div>
  );
}

async function PrimitiveDetail({
  id,
  currentUserId,
  viewerClerkId,
}: DetailProps & { id: number }) {
  const row = await db.query.primitives.findFirst({
    where: (table, { eq }) => eq(table.id, id),
  });
  if (!row) notFound();

  const vis = await checkVisibility({
    targetType: "PRIMITIVE",
    targetId: String(id),
    ownerId: row.userId ?? null,
    isPublic: row.isPublic,
    viewerId: viewerClerkId,
  });
  if (!vis.allowed) notFound();

  const author = await resolveAuthorByClerkId(row.userId);
  const engagement = await loadEngagement("PRIMITIVE", String(id), currentUserId);
  const [{ flagDistribution, flagNotes }, forkSource] = await Promise.all([
    loadFlagsAndTags("PRIMITIVE", String(id), []),
    loadForkSource("PRIMITIVE", String(id)),
  ]);

  return (
    <DetailShell
      backHref="/library/browse?type=PRIMITIVE"
      typeLabel="PRIMITIVE"
      name={row.name}
      buCost={row.buCost}
      category={row.category}
      description={row.narrativeRule || row.mechanicalOutputText || null}
      author={author}
      ownerId={row.userId}
      editHref={`/sandbox/grammar?build=primitive&edit=${row.id}`}
      targetType="PRIMITIVE"
      targetId={String(id)}
      engagement={engagement}
      currentUserId={currentUserId}
      tags={[]}
      flagDistribution={flagDistribution}
      flagNotes={flagNotes}
      forkSource={forkSource}
    iconSource={row.iconSource}
    iconKey={row.iconKey}
    iconUrl={row.iconUrl}
    iconColor={row.iconColor}
    >
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase text-muted-foreground">
          Mechanical Output
        </h2>
        <p className="whitespace-pre-wrap rounded-md bg-secondary/50 p-3 font-mono text-sm leading-6">
          {row.mechanicalOutputText || "(no mechanical output)"}
        </p>
      </section>

      <section className="mt-5 grid gap-3 sm:grid-cols-2">
        <DataField label="Cost tier" value={row.costTier} />
        <DataField
          label="Mirrorable"
          value={row.isMirrorable ? "Yes" : "No"}
        />
        {row.isMirrorable && (
          <DataField label="Mirror vector" value={row.mirrorVector} />
        )}
        {row.mirrorBuCredit > 0 && (
          <DataField
            label="Mirror BU credit"
            value={String(row.mirrorBuCredit)}
          />
        )}
      </section>

      {row.hardModifiers.length > 0 && (
        <section className="mt-5">
          <h2 className="mb-2 text-sm font-semibold uppercase text-muted-foreground">
            Hard Modifiers
          </h2>
          <ul className="ml-5 list-disc text-sm">
            {row.hardModifiers.map((m, i) => (
              <li key={i}>
                <span className="font-mono">{m.target}</span>:{" "}
                {m.operation} {String(m.value)}
              </li>
            ))}
          </ul>
        </section>
      )}
    </DetailShell>
  );
}

async function CapabilityDetail({
  id,
  currentUserId,
  viewerClerkId,
}: DetailProps & { id: string }) {
  const row = await db.query.capabilities.findFirst({
    where: (table, { eq }) => eq(table.id, id),
    with: {
      primitiveLinks: {
        with: { primitive: true },
      },
      // Mashu 2026-07-09: effectLinks now loaded so the source page
      // can render the "Composed effects" section (the modal preview
      // body already shows this; the source page previously didn't).
      effectLinks: {
        with: { effect: true },
      },
    },
  });
  if (!row) notFound();

  const vis = await checkVisibility({
    targetType: "CAPABILITY",
    targetId: id,
    ownerId: row.userId ?? null,
    isPublic: row.isPublic,
    viewerId: viewerClerkId,
  });
  if (!vis.allowed) notFound();

  const author = await resolveAuthorByClerkId(row.userId);

  let buTotal = 0;
  for (const link of row.primitiveLinks) {
    // Mashu 2026-07-09: Math.abs() per the mirror rule. Defensive.
    buTotal += Math.abs(link.primitive.buCost * link.quantity);
  }

  const engagement = await loadEngagement("CAPABILITY", id, currentUserId);
  const [{ flagDistribution, flagNotes }, forkSource, versionMap, effectBuMap] =
    await Promise.all([
      loadFlagsAndTags("CAPABILITY", id, row.tags ?? []),
      loadForkSource("CAPABILITY", id),
      bulkResolveLatestVersionNumbers([
        ...row.primitiveLinks.map((l) => ({
          kind: "primitive" as const,
          id: l.primitiveId,
        })),
        ...row.effectLinks.map((l) => ({ kind: "effect" as const, id: l.effectId })),
      ]),
      // Mashu 2026-07-09: per-effect cost map so each composed-effect
      // row can show its own BU contribution in the section below.
      bulkComputeEffectBuCost(row.effectLinks.map((l) => l.effectId)),
    ]);

  return (
    <DetailShell
      backHref="/library/browse?type=CAPABILITY"
      typeLabel="CAPABILITY"
      name={row.name}
      buCost={buTotal}
      category={row.type}
      description={row.verboseDescription || null}
      author={author}
      ownerId={row.userId}
      editHref={`/sandbox/grammar?build=capability&edit=${row.id}`}
      targetType="CAPABILITY"
      targetId={id}
      engagement={engagement}
      currentUserId={currentUserId}
      tags={row.tags ?? []}
      flagDistribution={flagDistribution}
      flagNotes={flagNotes}
      forkSource={forkSource}
    iconSource={row.iconSource}
    iconKey={row.iconKey}
    iconUrl={row.iconUrl}
    iconColor={row.iconColor}
    >
      <section className="grid gap-3 sm:grid-cols-2">
        <DataField label="Type" value={row.type} />
        <DataField label="Source" value={row.sourceType} />
        {row.sourceOrigin && (
          <DataField label="Origin" value={row.sourceOrigin} />
        )}
      </section>

      {row.tags.length > 0 && (
        <section className="mt-4">
          <h2 className="mb-2 text-sm font-semibold uppercase text-muted-foreground">
            Tags
          </h2>
          <div className="flex flex-wrap gap-1">
            {row.tags.map((t) => (
              <span
                key={t}
                className="rounded-full bg-secondary px-2 py-0.5 text-xs"
              >
                {t}
              </span>
            ))}
          </div>
        </section>
      )}

      <section className="mt-5">
        <h2 className="mb-2 text-sm font-semibold uppercase text-muted-foreground">
          Composed primitives ({row.primitiveLinks.length})
        </h2>
        <ul className="divide-y divide-border rounded-md border border-border">
          {row.primitiveLinks.map((link) => {
            const version =
              versionMap.get(`primitive:${link.primitiveId}` as VersionNumberKey) ?? null;
            return (
              <li
                key={`${link.capabilityId}-${link.primitiveId}-${link.role}`}
                className="flex items-center justify-between gap-2 p-3 text-sm"
              >
                <Link
                  href={`/library/item/PRIMITIVE:${link.primitiveId}`}
                  className="min-w-0 flex-1 truncate hover:underline"
                >
                  <SourceVersionChip versionNumber={version} />
                  <span className="font-semibold">{link.primitive.name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {link.role.replace(/_/g, " ")}
                  </span>
                </Link>
                <span className="shrink-0 font-mono text-xs">
                  {link.quantity}× · {Math.abs(link.primitive.buCost * link.quantity)} BU
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </li>
            );
          })}
        </ul>
      </section>

      {/* Mashu 2026-07-09: Composed effects section. The modal preview
          already shows this list; the source page was previously
          missing it. Effects contribute their own narrative + can
          nest further effects (handled in EffectDetail). */}
      {row.effectLinks.length > 0 && (
        <section className="mt-5">
          <h2 className="mb-2 text-sm font-semibold uppercase text-muted-foreground">
            Composed effects ({row.effectLinks.length})
          </h2>
          <ul className="divide-y divide-border rounded-md border border-border">
            {row.effectLinks.map((link) => {
              const version =
                versionMap.get(`effect:${link.effectId}` as VersionNumberKey) ?? null;
              // Mashu 2026-07-09: per-effect BU cost surfaced in the
              // composed-effects container, alongside the effect name.
              const bu = effectBuMap.get(link.effectId) ?? 0;
              return (
                <li
                  key={`${link.capabilityId}-${link.effectId}`}
                  className="flex items-center justify-between gap-2 p-3 text-sm"
                >
                  <Link
                    href={`/library/item/EFFECT:${link.effectId}`}
                    className="min-w-0 flex-1 truncate hover:underline"
                  >
                    <SourceVersionChip versionNumber={version} />
                    <span className="font-semibold">{link.effect.name}</span>
                    {link.slotLabel ? (
                      <span className="ml-2 text-xs italic text-muted-foreground">
                        "{link.slotLabel}"
                      </span>
                    ) : null}
                  </Link>
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">
                    {bu} BU
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </DetailShell>
  );
}

async function TemplateDetail({
  id,
  currentUserId,
  viewerClerkId,
}: DetailProps & { id: string }) {
  const row = await db.query.templates.findFirst({
    where: (table, { eq }) => eq(table.id, id),
    with: {
      primitiveLinks: { with: { primitive: true } },
      capabilityLinks: { with: { capability: true } },
    },
  });
  if (!row) notFound();

  const targetTypeForVis =
    row.kind === "RACE"
      ? "RACE_TEMPLATE"
      : row.kind === "BACKGROUND"
        ? "BACKGROUND_TEMPLATE"
        : "ARCHETYPE_TEMPLATE";
  const vis = await checkVisibility({
    targetType: targetTypeForVis,
    targetId: id,
    ownerId: row.userId ?? null,
    isPublic: row.isPublic,
    viewerId: viewerClerkId,
  });
  if (!vis.allowed) notFound();

  const typeLabel =
    row.kind === "RACE"
      ? "RACE"
      : row.kind === "BACKGROUND"
        ? "BACKGROUND"
        : "ARCHETYPE";

  const author = await resolveAuthorByClerkId(row.userId);

  const targetTypeForEngagement =
    row.kind === "RACE"
      ? "RACE_TEMPLATE"
      : row.kind === "BACKGROUND"
        ? "BACKGROUND_TEMPLATE"
        : "ARCHETYPE_TEMPLATE";

  const engagement = await loadEngagement(
    targetTypeForEngagement,
    id,
    currentUserId,
  );
  const [{ flagDistribution, flagNotes }, forkSource, versionMap, capabilityBuMap] =
    await Promise.all([
      loadFlagsAndTags(
        targetTypeForEngagement,
        id,
        [], // templates don't have a tags column yet
      ),
      loadForkSource(targetTypeForEngagement, id),
      // Resolve latest published version for every composed primitive and
      // capability. Templates compose templates (no effect link table for
      // templates), so we only need primitives + capabilities here.
      bulkResolveLatestVersionNumbers([
        ...row.primitiveLinks.map((l) => ({
          kind: "primitive" as const,
          id: l.primitiveId,
        })),
        ...row.capabilityLinks
          .filter((l) => l.capability != null)
          .map((l) => ({ kind: "capability" as const, id: l.capabilityId })),
      ]),
      // Mashu 2026-07-09: per-capability BU cost map for the
      // "Bundled capabilities" container below.
      bulkComputeCapabilityBuCost(
        row.capabilityLinks
          .filter((l) => l.capability != null)
          .map((l) => l.capabilityId),
      ),
    ]);

  return (
    <DetailShell
      backHref={`/library/browse?type=${typeLabel}_TEMPLATE`}
      typeLabel={`${typeLabel} TEMPLATE`}
      name={row.name}
      buCost={null}
      category={row.kind}
      description={row.description || null}
      author={author}
      ownerId={row.userId}
      editHref={`/sandbox/blueprint?build=template&edit=${row.id}`}
      targetType={targetTypeForEngagement}
      targetId={id}
      engagement={engagement}
      currentUserId={currentUserId}
      tags={[]}
      flagDistribution={flagDistribution}
      flagNotes={flagNotes}
      forkSource={forkSource}
    iconSource={row.iconSource}
    iconKey={row.iconKey}
    iconUrl={row.iconUrl}
    iconColor={row.iconColor}
    >
      {row.imageUrl && (
        <img
          src={row.imageUrl}
          alt={row.name}
          className="mb-4 w-full max-w-md rounded-md border border-border"
        />
      )}

      {row.suggestedTraits && (
        <section className="mb-5">
          <h2 className="mb-2 text-sm font-semibold uppercase text-muted-foreground">
            Suggested traits
          </h2>
          <div className="prose prose-invert prose-sm max-w-none break-words text-sm leading-7">
            <Markdown>{row.suggestedTraits}</Markdown>
          </div>
        </section>
      )}

      {row.primitiveLinks.length > 0 && (
        <section className="mb-5">
          <h2 className="mb-2 text-sm font-semibold uppercase text-muted-foreground">
            Bundled primitives ({row.primitiveLinks.length})
          </h2>
          <ul className="divide-y divide-border rounded-md border border-border">
            {row.primitiveLinks.map((link) => {
              const version =
                versionMap.get(`primitive:${link.primitiveId}` as VersionNumberKey) ?? null;
              return (
                <li
                  key={`${link.templateId}-${link.primitiveId}`}
                  className="flex items-center justify-between gap-2 p-3 text-sm"
                >
                  <Link
                    href={`/library/item/PRIMITIVE:${link.primitiveId}`}
                    className="min-w-0 flex-1 truncate hover:underline"
                  >
                    <SourceVersionChip versionNumber={version} />
                    <span className="font-semibold">{link.primitive.name}</span>
                  </Link>
                  <span className="shrink-0 font-mono text-xs">
                    {link.primitive.buCost} BU
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {row.capabilityLinks.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase text-muted-foreground">
            Bundled capabilities ({row.capabilityLinks.length})
          </h2>
          <ul className="divide-y divide-border rounded-md border border-border">
            {row.capabilityLinks.map((link) => {
              const version =
                versionMap.get(`capability:${link.capabilityId}` as VersionNumberKey) ?? null;
              // Defensive fallback: if the capability relation didn't
              // load (e.g. older data), show the uuid prefix instead of
              // crashing. The fix above ensures capability is loaded —
              // this only renders when something else has gone wrong.
              const label = link.capability
                ? link.capability.name
                : `capability ${link.capabilityId.slice(0, 8)}`;
              // Mashu 2026-07-09: per-capability BU cost surfaced in
              // the bundled-capabilities container.
              const bu = capabilityBuMap.get(link.capabilityId) ?? 0;
              return (
                <li
                  key={`${link.templateId}-${link.capabilityId}`}
                  className="flex items-center justify-between gap-2 p-3 text-sm"
                >
                  <Link
                    href={`/library/item/CAPABILITY:${link.capabilityId}`}
                    className="min-w-0 flex-1 truncate hover:underline"
                  >
                    <SourceVersionChip versionNumber={version} />
                    <span className="font-semibold">{label}</span>
                  </Link>
                  {link.capability ? (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {link.capability.type}
                    </span>
                  ) : null}
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">
                    {bu} BU
                  </span>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </DetailShell>
  );
}

async function EffectDetail({
  id,
  currentUserId,
  viewerClerkId,
}: DetailProps & { id: string }) {
  // Step 1: load the effect + its primitive links.
  // Use raw select() instead of db.query.effects.findFirst({ with: ... }) —
  // Drizzle's relational query API auto-includes ALL relations defined on
  // `effects` (including nestedAsParent/nestedAsChild self-relations),
  // which makes it recurse into a deeply-nested LATERAL chain that Postgres
  // rejects with "column ... does not exist" because non-LATERAL subqueries
  // can't reference outer columns.
  const effectRow = await db.query.effects.findFirst({
    where: (table, { eq }) => eq(table.id, id),
  });
  if (!effectRow) notFound();

  const vis = await checkVisibility({
    targetType: "EFFECT",
    targetId: id,
    ownerId: effectRow.userId ?? null,
    isPublic: effectRow.isPublic,
    viewerId: viewerClerkId,
  });
  if (!vis.allowed) notFound();

  const primitiveLinks = await db.query.effectPrimitives.findMany({
    where: (table, { eq }) => eq(table.effectId, id),
    with: { primitive: true },
  });

  // Step 2: separately load children (this effect as parent) — 1 level
  const childEdges = await db.query.effectEffects.findMany({
    where: (table, { eq }) => eq(table.parentEffectId, id),
    with: {
      childEffect: {
        with: {
          primitiveLinks: { with: { primitive: true } },
        },
      },
    },
  });

  // Step 3: separately load parents (effects that nest this one)
  const parentEdges = await db.query.effectEffects.findMany({
    where: (table, { eq }) => eq(table.childEffectId, id),
    with: {
      parentEffect: true,
    },
  });

  // Compute BU total
  let buTotal = 0;
  for (const link of primitiveLinks) {
    // Mashu 2026-07-09: Math.abs() per the mirror rule. Defensive.
    buTotal += Math.abs(link.primitive.buCost * link.quantity);
  }

  const author = await resolveAuthorByClerkId(effectRow.userId);
  const engagement = await loadEngagement("EFFECT", id, currentUserId);
  const [{ flagDistribution, flagNotes }, forkSource, versionMap] =
    await Promise.all([
      loadFlagsAndTags("EFFECT", id, effectRow.tags ?? []),
      loadForkSource("EFFECT", id),
      bulkResolveLatestVersionNumbers([
        ...primitiveLinks.map((l) => ({
          kind: "primitive" as const,
          id: l.primitiveId,
        })),
        ...childEdges.map((e) => ({ kind: "effect" as const, id: e.childEffectId })),
        ...parentEdges.map((e) => ({
          kind: "effect" as const,
          id: e.parentEffectId,
        })),
      ]),
    ]);

  const parentEffects = parentEdges.map((edge) => edge.parentEffect);
  const childEffects = childEdges.map((edge) => edge.childEffect);

  return (
    <DetailShell
      backHref="/library/browse?type=EFFECT"
      typeLabel="EFFECT"
      name={effectRow.name}
      buCost={buTotal > 0 ? buTotal : null}
      category="condition"
      description={effectRow.narrativeDescription || null}
      author={author}
      ownerId={effectRow.userId}
      editHref={`/sandbox/grammar?build=effect&edit=${id}`}
      targetType="EFFECT"
      targetId={id}
      engagement={engagement}
      currentUserId={currentUserId}
      tags={effectRow.tags ?? []}
      flagDistribution={flagDistribution}
      flagNotes={flagNotes}
      forkSource={forkSource}
    iconSource={effectRow.iconSource}
    iconKey={effectRow.iconKey}
    iconUrl={effectRow.iconUrl}
    iconColor={effectRow.iconColor}
    >
      {effectRow.tags.length > 0 && (
        <section className="mb-5">
          <h2 className="mb-2 text-sm font-semibold uppercase text-muted-foreground">
            Tags
          </h2>
          <div className="flex flex-wrap gap-1">
            {effectRow.tags.map((t) => (
              <span
                key={t}
                className="rounded-full bg-secondary px-2 py-0.5 text-xs"
              >
                {t}
              </span>
            ))}
          </div>
        </section>
      )}

      {primitiveLinks.length > 0 && (
        <section className="mb-5">
          <h2 className="mb-2 text-sm font-semibold uppercase text-muted-foreground">
            Composed primitives ({primitiveLinks.length})
          </h2>
          <ul className="divide-y divide-border rounded-md border border-border">
            {primitiveLinks.map((link) => {
              const version =
                versionMap.get(`primitive:${link.primitiveId}` as VersionNumberKey) ?? null;
              return (
                <li
                  key={`${link.effectId}-${link.primitiveId}`}
                  className="flex items-center justify-between gap-2 p-3 text-sm"
                >
                  <Link
                    href={`/library/item/PRIMITIVE:${link.primitiveId}`}
                    className="min-w-0 flex-1 truncate hover:underline"
                  >
                    <SourceVersionChip versionNumber={version} />
                    <span className="font-semibold">{link.primitive.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {link.primitive.category.replace(/_/g, " ")}
                    </span>
                  </Link>
                  <span className="shrink-0 font-mono text-xs">
                    {link.quantity}× · {Math.abs(link.primitive.buCost * link.quantity)} BU
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {parentEffects.length > 0 && (
        <section className="mb-5">
          <h2 className="mb-2 text-sm font-semibold uppercase text-muted-foreground">
            Nested under
          </h2>
          <ul className="divide-y divide-border rounded-md border border-border">
            {parentEffects.map((parent) => {
              const version =
                versionMap.get(`effect:${parent.id}` as VersionNumberKey) ?? null;
              return (
                <li key={parent.id} className="p-3 text-sm">
                  <SourceVersionChip versionNumber={version} />
                  <Link
                    href={`/library/item/EFFECT:${parent.id}`}
                    className="font-semibold hover:underline"
                  >
                    {parent.name}
                  </Link>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {parent.narrativeDescription?.slice(0, 200)}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {childEffects.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase text-muted-foreground">
            Nests ({childEffects.length})
          </h2>
          <ul className="divide-y divide-border rounded-md border border-border">
            {childEffects.map((child) => {
              const version =
                versionMap.get(`effect:${child.id}` as VersionNumberKey) ?? null;
              return (
                <li key={child.id} className="p-3 text-sm">
                  <SourceVersionChip versionNumber={version} />
                  <Link
                    href={`/library/item/EFFECT:${child.id}`}
                    className="font-semibold hover:underline"
                  >
                    {child.name}
                  </Link>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {child.narrativeDescription?.slice(0, 200)}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </DetailShell>
  );
}

async function ItemDetail({
  id,
  currentUserId,
  viewerClerkId,
}: DetailProps & { id: string }) {
  const itemRow = await db.query.items.findFirst({
    where: (table, { eq }) => eq(table.id, id),
  });
  if (!itemRow) notFound();

  const vis = await checkVisibility({
    targetType: "ITEM",
    targetId: id,
    ownerId: itemRow.userId ?? null,
    isPublic: itemRow.isPublic,
    viewerId: viewerClerkId,
  });
  if (!vis.allowed) notFound();

  // Items compose primitives + effects + capabilities (the user's spec
  // for item composition). Load all three in parallel.
  const [primitiveLinks, effectLinks, capabilityLinks] = await Promise.all([
    db.query.itemPrimitives.findMany({
      where: (table, { eq }) => eq(table.itemId, id),
      with: { primitive: true },
    }),
    db.query.itemEffects.findMany({
      where: (table, { eq }) => eq(table.itemId, id),
      with: { effect: true },
    }),
    db.query.itemCapabilities.findMany({
      where: (table, { eq }) => eq(table.itemId, id),
      with: { capability: true },
    }),
  ]);

  // Compute BU total from composed primitives (same shape as item form).
  let buTotal = 0;
  for (const link of primitiveLinks) {
    buTotal += link.primitive.buCost;
  }

  const author = await resolveAuthorByClerkId(itemRow.userId);
  const engagement = await loadEngagement("ITEM", id, currentUserId);
  const [
    { flagDistribution, flagNotes },
    forkSource,
    versionMap,
    effectBuMap,
    capabilityBuMap,
  ] = await Promise.all([
    loadFlagsAndTags("ITEM", id, itemRow.tags ?? []),
    loadForkSource("ITEM", id),
    bulkResolveLatestVersionNumbers([
      ...primitiveLinks.map((l) => ({
        kind: "primitive" as const,
        id: l.primitiveId,
      })),
      ...effectLinks.map((l) => ({ kind: "effect" as const, id: l.effectId })),
      ...capabilityLinks.map((l) => ({
        kind: "capability" as const,
        id: l.capabilityId,
      })),
    ]),
    // Mashu 2026-07-09: per-effect + per-capability BU cost so the
    // "Composed effects" and "Composed capabilities" containers show
    // each row's own cost (not just the parent total).
    bulkComputeEffectBuCost(effectLinks.map((l) => l.effectId)),
    bulkComputeCapabilityBuCost(capabilityLinks.map((l) => l.capabilityId)),
  ]);

  // Rarity class for the chip. itemRarityEnum is the schema enum;
  // we map each value to a tailwind color pair. Cast through string
  // to defeat Drizzle's literal-type narrowing in the chained
  // ternary (Drizzle resolves `itemRow.rarity` to a union of literal
  // strings and TS thinks each branch exhausts one).
  const rarity = String(itemRow.rarity);
  const rarityClass =
    rarity === "COMMON"
      ? "bg-slate-500/15 text-slate-700 dark:text-slate-300"
      : rarity === "UNCOMMON"
        ? "bg-green-500/15 text-green-700 dark:text-green-400"
        : rarity === "RARE"
          ? "bg-blue-500/15 text-blue-700 dark:text-blue-400"
          : rarity === "EPIC"
            ? "bg-purple-500/15 text-purple-700 dark:text-purple-400"
            : rarity === "LEGENDARY"
              ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
              : "bg-secondary";

  return (
    <DetailShell
      backHref="/library/browse?type=ITEM"
      typeLabel="ITEM"
      name={itemRow.name}
      buCost={buTotal > 0 || itemRow.buCost > 0 ? (buTotal || itemRow.buCost) : null}
      category={itemRow.itemType}
      description={itemRow.description || null}
      author={author}
      ownerId={itemRow.userId}
      editHref={
        itemRow.userId
          ? `/sandbox/blueprint?build=item&edit=${id}`
          : null
      }
      targetType="ITEM"
      targetId={id}
      engagement={engagement}
      currentUserId={currentUserId}
      tags={itemRow.tags ?? []}
      flagDistribution={flagDistribution}
      flagNotes={flagNotes}
      forkSource={forkSource}
    iconSource={itemRow.iconSource}
    iconKey={itemRow.iconKey}
    iconUrl={itemRow.iconUrl}
    iconColor={itemRow.iconColor}
    >
      <section className="mb-5">
        <h2 className="mb-2 text-sm font-semibold uppercase text-muted-foreground">
          Properties
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <DataField label="Type" value={itemRow.itemType} />
          <div className="rounded-md border border-border bg-background p-3">
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              Rarity
            </p>
            <p className="mt-1">
              <span
                className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${rarityClass}`}
              >
                {itemRow.rarity}
              </span>
            </p>
          </div>
          <DataField label="Slot cost" value={String(itemRow.slotCost)} />
          <DataField label="Quantity" value={String(itemRow.quantity)} />
          {itemRow.isTwoHanded ? (
            <DataField label="Handedness" value="Two-handed" />
          ) : null}
          {itemRow.isConsumable ? (
            <DataField label="Consumable" value="Yes" />
          ) : null}
          {itemRow.actsAsFocus ? (
            <DataField label="Acts as focus" value="Yes" />
          ) : null}
          {itemRow.sourceOrigin ? (
            <DataField label="Source" value={itemRow.sourceOrigin} />
          ) : null}
        </div>
      </section>

      {itemRow.description ? (
        <section className="mb-5">
          <h2 className="mb-2 text-sm font-semibold uppercase text-muted-foreground">
            Description
          </h2>
          <div className="rounded-md border border-border bg-background p-4 [&_p]:m-0">
            <Markdown>{itemRow.description}</Markdown>
          </div>
        </section>
      ) : null}

      {itemRow.tags.length > 0 && (
        <section className="mb-5">
          <h2 className="mb-2 text-sm font-semibold uppercase text-muted-foreground">
            Tags
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {itemRow.tags.map((t) => (
              <Link
                key={t}
                href={`/library/browse?type=ITEM&tag=${encodeURIComponent(t)}`}
                className="rounded-full border border-border bg-secondary px-2.5 py-0.5 text-xs hover:border-primary"
              >
                {t}
              </Link>
            ))}
          </div>
        </section>
      )}

      {primitiveLinks.length > 0 && (
        <section className="mb-5">
          <h2 className="mb-2 text-sm font-semibold uppercase text-muted-foreground">
            Composed primitives ({primitiveLinks.length})
          </h2>
          <ul className="divide-y divide-border rounded-md border border-border">
            {primitiveLinks.map((link) => {
              const version =
                versionMap.get(`primitive:${link.primitiveId}` as VersionNumberKey) ?? null;
              return (
                <li
                  key={`${link.itemId}-${link.primitiveId}`}
                  className="flex items-center justify-between gap-2 p-3 text-sm"
                >
                  <Link
                    href={`/library/item/PRIMITIVE:${link.primitiveId}`}
                    className="min-w-0 flex-1 truncate hover:underline"
                  >
                    <SourceVersionChip versionNumber={version} />
                    <span className="font-semibold">{link.primitive.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {link.primitive.category.replace(/_/g, " ")}
                    </span>
                  </Link>
                  <span className="shrink-0 font-mono text-xs">
                    {link.primitive.buCost} BU
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {effectLinks.length > 0 && (
        <section className="mb-5">
          <h2 className="mb-2 text-sm font-semibold uppercase text-muted-foreground">
            Composed effects ({effectLinks.length})
          </h2>
          <ul className="divide-y divide-border rounded-md border border-border">
            {effectLinks.map((link) => {
              const version =
                versionMap.get(`effect:${link.effectId}` as VersionNumberKey) ?? null;
              // Mashu 2026-07-09: per-effect BU cost in composed list.
              const bu = effectBuMap.get(link.effectId) ?? 0;
              return (
                <li
                  key={`${link.itemId}-${link.effectId}`}
                  className="flex items-center justify-between gap-2 p-3 text-sm"
                >
                  <Link
                    href={`/library/item/EFFECT:${link.effectId}`}
                    className="min-w-0 flex-1 truncate hover:underline"
                  >
                    <SourceVersionChip versionNumber={version} />
                    <span className="font-semibold">{link.effect.name}</span>
                  </Link>
                  {link.slotLabel ? (
                    <span className="shrink-0 text-xs italic text-muted-foreground">
                      "{link.slotLabel}"
                    </span>
                  ) : null}
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">
                    {bu} BU
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {capabilityLinks.length > 0 && (
        <section className="mb-5">
          <h2 className="mb-2 text-sm font-semibold uppercase text-muted-foreground">
            Composed capabilities ({capabilityLinks.length})
          </h2>
          <ul className="divide-y divide-border rounded-md border border-border">
            {capabilityLinks.map((link) => {
              const version =
                versionMap.get(`capability:${link.capabilityId}` as VersionNumberKey) ?? null;
              // Mashu 2026-07-09: per-capability BU cost in composed list.
              const bu = capabilityBuMap.get(link.capabilityId) ?? 0;
              return (
                <li
                  key={`${link.itemId}-${link.capabilityId}`}
                  className="flex items-center justify-between gap-2 p-3 text-sm"
                >
                  <Link
                    href={`/library/item/CAPABILITY:${link.capabilityId}`}
                    className="min-w-0 flex-1 truncate hover:underline"
                  >
                    <SourceVersionChip versionNumber={version} />
                    <span className="font-semibold">{link.capability.name}</span>
                  </Link>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {link.capability.type}
                  </span>
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">
                    {bu} BU
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </DetailShell>
  );
}

function DataField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <p className="text-xs font-semibold uppercase text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm">{value}</p>
    </div>
  );
}

// -----------------------------------------------------------------------------
// SourceVersionChip — small pill rendering the latest published version of a
// referenced primitive/effect/capability on a source page. Null = entity has
// never been published (still draft); renders nothing. Same visual style as
// the modal preview's VersionChip so users see the same chip in both places.
// -----------------------------------------------------------------------------

function SourceVersionChip({
  versionNumber,
}: {
  versionNumber: number | null;
}) {
  if (versionNumber == null) return null;
  // Mashu 2026-07-09: chip rendered LEFT of the entity name. mr-1.5
  // creates space between chip and name. Mirrors the modal preview's
  // VersionChip so the visual identity is identical in both places.
  return (
    <span
      className="mr-1.5 inline-flex shrink-0 items-center rounded-full border border-border/60 bg-muted/40 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
      title={`Latest published version v${versionNumber}`}
    >
      v{versionNumber}
    </span>
  );
}