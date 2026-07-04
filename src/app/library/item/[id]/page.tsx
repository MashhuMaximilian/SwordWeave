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
import { ArrowLeft, ChevronRight, User as UserIcon } from "lucide-react";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  forkAggregates,
  reactionAggregates,
  reactions,
} from "@/db/schema";
import { LikeForkBar } from "@/components/engagement/like-fork-bar";
import { Markdown } from "@/components/ui/markdown";
import {
  resolveAuthorByClerkId,
  resolveUserIdByClerkId,
} from "@/lib/auth/author-resolver";
import { resolveVirtualVersionId } from "@/lib/engagement/version-helpers";

export const dynamic = "force-dynamic";

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
  const versionId = resolveVirtualVersionId(
    targetType as never,
    targetId,
  );

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
  targetType,
  targetId,
  engagement,
  currentUserId,
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
  targetType: string;
  targetId: string;
  engagement: EngagementData;
  currentUserId: string | null;
}) {
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
            <h1 className="break-words text-3xl font-semibold">{name}</h1>
            {buCost !== null && (
              <span className="rounded-full bg-primary/10 px-3 py-1 font-mono text-sm font-semibold text-primary">
                {buCost} BU
              </span>
            )}
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

  const author = await resolveAuthorByClerkId(row.userId);
  const engagement = await loadEngagement("PRIMITIVE", String(id), currentUserId);

  return (
    <DetailShell
      backHref="/library/browse?type=PRIMITIVE"
      typeLabel="PRIMITIVE"
      name={row.name}
      buCost={row.buCost}
      category={row.category}
      description={row.narrativeRule || row.mechanicalOutputText || null}
      author={author}
      targetType="PRIMITIVE"
      targetId={String(id)}
      engagement={engagement}
      currentUserId={currentUserId}
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
    },
  });
  if (!row) notFound();

  let buTotal = 0;
  for (const link of row.primitiveLinks) {
    buTotal += link.primitive.buCost * link.quantity;
  }

  const engagement = await loadEngagement("CAPABILITY", id, currentUserId);

  return (
    <DetailShell
      backHref="/library/browse?type=CAPABILITY"
      typeLabel="CAPABILITY"
      name={row.name}
      buCost={buTotal}
      category={row.type}
      description={row.verboseDescription || null}
      author={null}
      targetType="CAPABILITY"
      targetId={id}
      engagement={engagement}
      currentUserId={currentUserId}
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
          {row.primitiveLinks.map((link) => (
            <li
              key={`${link.capabilityId}-${link.primitiveId}-${link.role}`}
              className="flex items-center justify-between gap-2 p-3 text-sm"
            >
              <Link
                href={`/library/item/PRIMITIVE:${link.primitiveId}`}
                className="min-w-0 flex-1 truncate hover:underline"
              >
                <span className="font-semibold">{link.primitive.name}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {link.role.replace(/_/g, " ")}
                </span>
              </Link>
              <span className="shrink-0 font-mono text-xs">
                {link.quantity}× · {link.primitive.buCost * link.quantity} BU
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </li>
          ))}
        </ul>
      </section>
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
      capabilityLinks: true,
    },
  });
  if (!row) notFound();

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

  return (
    <DetailShell
      backHref={`/library/browse?type=${typeLabel}_TEMPLATE`}
      typeLabel={`${typeLabel} TEMPLATE`}
      name={row.name}
      buCost={null}
      category={row.kind}
      description={row.description || null}
      author={author}
      targetType={targetTypeForEngagement}
      targetId={id}
      engagement={engagement}
      currentUserId={currentUserId}
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
            {row.primitiveLinks.map((link) => (
              <li
                key={`${link.templateId}-${link.primitiveId}`}
                className="flex items-center justify-between gap-2 p-3 text-sm"
              >
                <Link
                  href={`/library/item/PRIMITIVE:${link.primitiveId}`}
                  className="min-w-0 flex-1 truncate hover:underline"
                >
                  <span className="font-semibold">{link.primitive.name}</span>
                </Link>
                <span className="shrink-0 font-mono text-xs">
                  {link.primitive.buCost} BU
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {row.capabilityLinks.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase text-muted-foreground">
            Bundled capabilities ({row.capabilityLinks.length})
          </h2>
          <ul className="divide-y divide-border rounded-md border border-border">
            {row.capabilityLinks.map((link) => (
              <li
                key={`${link.templateId}-${link.capabilityId}`}
                className="flex items-center justify-between gap-2 p-3 text-sm"
              >
                <Link
                  href={`/library/item/CAPABILITY:${link.capabilityId}`}
                  className="min-w-0 flex-1 truncate hover:underline"
                >
                  <span className="font-semibold">
                    capability {link.capabilityId.slice(0, 8)}
                  </span>
                </Link>
                <ChevronRight className="size-4 text-muted-foreground" />
              </li>
            ))}
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
  const row = await db.query.effects.findFirst({
    where: (table, { eq }) => eq(table.id, id),
    with: {
      primitiveLinks: { with: { primitive: true } },
      // Nested effects — children of this effect (recursive, 1 level)
      nestedAsParent: {
        with: {
          childEffect: {
            with: {
              primitiveLinks: { with: { primitive: true } },
              nestedAsParent: {
                with: {
                  childEffect: {
                    with: {
                      primitiveLinks: { with: { primitive: true } },
                    },
                  },
                },
              },
            },
          },
        },
      },
      // Effects that nest this one (parent chain, 1 level up)
      nestedAsChild: {
        with: {
          parentEffect: true,
        },
      },
    },
  });
  if (!row) notFound();

  // Compute BU total
  let buTotal = 0;
  for (const link of row.primitiveLinks) {
    buTotal += link.primitive.buCost * link.quantity;
  }

  const author = await resolveAuthorByClerkId(row.userId);
  const engagement = await loadEngagement("EFFECT", id, currentUserId);

  // Build nested effect chain (for the "nested under" + "nests" sections)
  const parentEffects = row.nestedAsChild.map((edge) => edge.parentEffect);
  const childEffects = row.nestedAsParent.map((edge) => edge.childEffect);

  return (
    <DetailShell
      backHref="/library/browse?type=EFFECT"
      typeLabel="EFFECT"
      name={row.name}
      buCost={buTotal > 0 ? buTotal : null}
      category="condition"
      description={row.narrativeDescription || null}
      author={author}
      targetType="EFFECT"
      targetId={id}
      engagement={engagement}
      currentUserId={currentUserId}
    >
      {row.tags.length > 0 && (
        <section className="mb-5">
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

      {row.primitiveLinks.length > 0 && (
        <section className="mb-5">
          <h2 className="mb-2 text-sm font-semibold uppercase text-muted-foreground">
            Composed primitives ({row.primitiveLinks.length})
          </h2>
          <ul className="divide-y divide-border rounded-md border border-border">
            {row.primitiveLinks.map((link) => (
              <li
                key={`${link.effectId}-${link.primitiveId}`}
                className="flex items-center justify-between gap-2 p-3 text-sm"
              >
                <Link
                  href={`/library/item/PRIMITIVE:${link.primitiveId}`}
                  className="min-w-0 flex-1 truncate hover:underline"
                >
                  <span className="font-semibold">{link.primitive.name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {link.primitive.category.replace(/_/g, " ")}
                  </span>
                </Link>
                <span className="shrink-0 font-mono text-xs">
                  {link.quantity}× · {link.primitive.buCost * link.quantity} BU
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {parentEffects.length > 0 && (
        <section className="mb-5">
          <h2 className="mb-2 text-sm font-semibold uppercase text-muted-foreground">
            Nested under
          </h2>
          <ul className="divide-y divide-border rounded-md border border-border">
            {parentEffects.map((parent) => (
              <li key={parent.id} className="p-3 text-sm">
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
            ))}
          </ul>
        </section>
      )}

      {childEffects.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase text-muted-foreground">
            Nests ({childEffects.length})
          </h2>
          <ul className="divide-y divide-border rounded-md border border-border">
            {childEffects.map((child) => (
              <li key={child.id} className="p-3 text-sm">
                <Link
                  href={`/library/item/EFFECT:${child.id}`}
                  className="font-semibold hover:underline"
                >
                  {child.name}
                </Link>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                  {child.narrativeDescription?.slice(0, 200)}
                </p>
                {child.nestedAsParent.length > 0 && (
                  <p className="mt-1 text-xs italic text-muted-foreground">
                    which itself nests {child.nestedAsParent.length} effect
                    {child.nestedAsParent.length === 1 ? "" : "s"}
                  </p>
                )}
              </li>
            ))}
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