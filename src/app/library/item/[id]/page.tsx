// =============================================================================
// /library/item/[id] — public detail view for a library item
// id format: `<type>:<id>` e.g. "PRIMITIVE:42", "CAPABILITY:abc-uuid",
//            "RACE_TEMPLATE:def-uuid"
// =============================================================================

import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ChevronRight,
  GitFork,
  Heart,
  Sparkles,
  User as UserIcon,
} from "lucide-react";
import { db } from "@/db/client";
import {
  capabilities,
  capabilityPrimitives,
  characters,
  primitives,
  templates,
} from "@/db/schema";
import { eq, inArray } from "drizzle-orm";

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

export default async function LibraryItemPage({ params }: PageProps) {
  const { id: rawId } = await params;
  const parsed = parseCompositeId(decodeURIComponent(rawId));
  if (!parsed) notFound();

  const { type, id } = parsed;

  if (type === "PRIMITIVE") {
    const numericId = Number(id);
    if (!Number.isFinite(numericId)) notFound();
    return <PrimitiveDetail id={numericId} />;
  }
  if (type === "CAPABILITY") {
    return <CapabilityDetail id={id} />;
  }
  if (
    type === "RACE_TEMPLATE" ||
    type === "BACKGROUND_TEMPLATE" ||
    type === "ARCHETYPE_TEMPLATE"
  ) {
    return <TemplateDetail id={id} />;
  }
  if (type === "CHARACTER") {
    return <CharacterDetail id={id} />;
  }
  notFound();
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
  engagement,
}: {
  children: React.ReactNode;
  backHref: string;
  typeLabel: string;
  name: string;
  buCost: number | null;
  category: string | null;
  description: string | null;
  author:
    | {
        username: string;
        displayName: string | null;
        avatarUrl: string | null;
      }
    | null
    | undefined;
  engagement: {
    likes: number;
    forks: number;
    net: number;
  };
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
            <h1 className="text-3xl font-semibold">{name}</h1>
            {buCost !== null && (
              <span className="rounded-full bg-primary/10 px-3 py-1 font-mono text-sm font-semibold text-primary">
                {buCost} BU
              </span>
            )}
          </div>
          {author?.username && (
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
            <p className="whitespace-pre-wrap text-sm leading-7">
              {description}
            </p>
          </section>
        )}

        <div className="mt-5">{children}</div>

        <footer className="mt-6 flex flex-wrap items-center gap-4 border-t border-border pt-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Heart className="size-4" />
            <span className="font-mono">{engagement.likes}</span> likes
          </span>
          <span className="flex items-center gap-1.5">
            <GitFork className="size-4" />
            <span className="font-mono">{engagement.forks}</span> forks
          </span>
          <span className="flex items-center gap-1.5">
            <Sparkles className="size-4" />
            <span className="font-mono">
              {engagement.net >= 0 ? "+" : ""}
              {engagement.net}
            </span>{" "}
            net
          </span>
        </footer>
      </article>
    </div>
  );
}

async function PrimitiveDetail({ id }: { id: number }) {
  const row = await db.query.primitives.findFirst({
    where: (table, { eq }) => eq(table.id, id),
  });
  if (!row) notFound();

  const author = row.userId
    ? await db.query.users.findFirst({
        where: (table, { eq }) => eq(table.id, row.userId!),
        columns: { username: true, displayName: true, avatarUrl: true },
      })
    : null;

  return (
    <DetailShell
      backHref="/library/browse?type=PRIMITIVE"
      typeLabel="PRIMITIVE"
      name={row.name}
      buCost={row.buCost}
      category={row.category}
      description={row.narrativeRule || row.mechanicalOutputText || null}
      author={
        author
          ? {
              username: author.username,
              displayName: author.displayName,
              avatarUrl: author.avatarUrl,
            }
          : null
      }
      engagement={{ likes: 0, forks: 0, net: 0 }}
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

async function CapabilityDetail({ id }: { id: string }) {
  const row = await db.query.capabilities.findFirst({
    where: (table, { eq }) => eq(table.id, id),
    with: {
      primitiveLinks: {
        with: { primitive: true },
      },
    },
  });
  if (!row) notFound();

  // Compute BU total
  let buTotal = 0;
  for (const link of row.primitiveLinks) {
    buTotal += link.primitive.buCost * link.quantity;
  }

  return (
    <DetailShell
      backHref="/library/browse?type=CAPABILITY"
      typeLabel="CAPABILITY"
      name={row.name}
      buCost={buTotal}
      category={row.type}
      description={row.verboseDescription || null}
      author={null}
      engagement={{ likes: 0, forks: 0, net: 0 }}
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

async function TemplateDetail({ id }: { id: string }) {
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

  const author = row.userId
    ? await db.query.users.findFirst({
        where: (table, { eq }) => eq(table.id, row.userId!),
        columns: { username: true, displayName: true, avatarUrl: true },
      })
    : null;

  return (
    <DetailShell
      backHref={`/library/browse?type=${typeLabel}_TEMPLATE`}
      typeLabel={`${typeLabel} TEMPLATE`}
      name={row.name}
      buCost={null}
      category={row.kind}
      description={row.description || null}
      author={
        author
          ? {
              username: author.username,
              displayName: author.displayName,
              avatarUrl: author.avatarUrl,
            }
          : null
      }
      engagement={{ likes: 0, forks: 0, net: 0 }}
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
          <p className="whitespace-pre-wrap text-sm">{row.suggestedTraits}</p>
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
                <span className="truncate font-semibold">
                  capability {link.capabilityId.slice(0, 8)}
                </span>
                <ChevronRight className="size-4 text-muted-foreground" />
              </li>
            ))}
          </ul>
        </section>
      )}
    </DetailShell>
  );
}

async function CharacterDetail({ id }: { id: string }) {
  const row = await db.query.characters.findFirst({
    where: (table, { eq }) => eq(table.id, id),
  });
  if (!row) notFound();
  return (
    <DetailShell
      backHref="/library/browse?type=CHARACTER"
      typeLabel="CHARACTER"
      name={row.name}
      buCost={null}
      category={row.size}
      description={row.notes || null}
      author={null}
      engagement={{ likes: 0, forks: 0, net: 0 }}
    >
      <section className="grid gap-3 sm:grid-cols-3">
        <DataField label="Level" value={String(row.level)} />
        <DataField label="Size" value={row.size} />
        <DataField
          label="Attributes"
          value={`P${row.attrPhysical} M${row.attrMental} C${row.attrMagical}`}
        />
      </section>
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