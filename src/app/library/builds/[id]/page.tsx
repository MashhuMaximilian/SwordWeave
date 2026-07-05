// =============================================================================
// /library/builds/[id] — public read view for a published build.
//
// Renders the build's race, background, archetype, attribute distribution,
// and capability links. Owner sees their own private builds; non-owners
// get 404 (handled by loader).
// =============================================================================

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Shield, Sparkles, User as UserIcon } from "lucide-react";
import { auth } from "@clerk/nextjs/server";
import { loadPublicBuild } from "@/lib/builds/build-loader";
import { resolveUserIdByClerkId } from "@/lib/auth/author-resolver";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function BuildDetailPage({ params }: PageProps) {
  const { id } = await params;

  // Validate UUID format before hitting the DB — invalid IDs return 404.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    notFound();
  }

  const { userId: clerkUserId } = await auth();
  const ownerInternalId = clerkUserId
    ? await resolveUserIdByClerkId(clerkUserId)
    : null;

  const build = await loadPublicBuild(id, {
    includePrivateForUserId: ownerInternalId,
  });
  if (!build) notFound();

  const authorDisplay =
    build.author && !build.author.isAnonymized
      ? (build.author.displayName ?? `@${build.author.username}`)
      : null;

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-8">
      <Link
        href="/library/browse"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> Back to library
      </Link>

      <article className="space-y-6">
        <header className="border-b border-border pb-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Build
          </p>
          <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
            <h1 className="font-display break-words text-3xl font-semibold uppercase tracking-wide">
              {build.name}
            </h1>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="rounded-full border border-border bg-card px-2.5 py-1 font-mono">
                Level {build.level}
              </span>
              <span className="rounded-full border border-border bg-card px-2.5 py-1 font-mono">
                {build.startingBu} BU
              </span>
              {build.isArchetypeTemplate && (
                <span className="rounded-full bg-primary/10 px-2.5 py-1 font-semibold text-primary">
                  Archetype template
                </span>
              )}
            </div>
          </div>

          {authorDisplay && (
            <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
              <UserIcon className="size-4" aria-hidden="true" />
              By{" "}
              <Link
                href={`/u/${build.author!.username}`}
                className="font-medium text-foreground hover:underline"
              >
                @{build.author!.username}
              </Link>
            </p>
          )}

          {build.description && (
            <p className="mt-3 text-sm leading-6 text-foreground">
              {build.description}
            </p>
          )}
        </header>

        {/* Race + Background */}
        <section className="grid gap-3 sm:grid-cols-2">
          <SlotCard
            icon={<Sparkles className="size-4" aria-hidden="true" />}
            label="Race"
            name={build.race?.name}
            description={build.race?.description}
          />
          <SlotCard
            icon={<Shield className="size-4" aria-hidden="true" />}
            label="Background"
            name={build.background?.name}
            description={build.background?.description}
          />
        </section>

        {/* Attributes */}
        <section className="rounded-md border border-border bg-card p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Attributes
          </h2>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <AttrBar label="Physical" value={build.attributes.physical} proficient={build.attributes.proficient === "PHYSICAL"} />
            <AttrBar label="Mental" value={build.attributes.mental} proficient={build.attributes.proficient === "MENTAL"} />
            <AttrBar label="Magical" value={build.attributes.magical} proficient={build.attributes.proficient === "MAGICAL"} />
          </div>
        </section>

        {/* Capabilities */}
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Capabilities ({build.capabilities.length})
          </h2>
          {build.capabilities.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              No capabilities linked yet.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {build.capabilities.map((cap) => (
                <li
                  key={cap.id}
                  className="rounded-md border border-border bg-card p-3"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-sm font-semibold text-foreground">
                      {cap.name}
                    </p>
                    <span className="text-xs uppercase text-muted-foreground">
                      {cap.type.replace(/_/g, " ")}
                    </span>
                  </div>
                  {cap.verboseDescription && (
                    <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">
                      {cap.verboseDescription}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </article>
    </div>
  );
}

function SlotCard({
  icon,
  label,
  name,
  description,
}: {
  icon: React.ReactNode;
  label: string;
  name?: string | null | undefined;
  description?: string | null | undefined;
}) {
  return (
    <div className="rounded-md border border-border bg-card p-4">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </p>
      {name ? (
        <>
          <p className="mt-1 text-base font-semibold">{name}</p>
          {description && (
            <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">
              {description}
            </p>
          )}
        </>
      ) : (
        <p className="mt-1 text-sm italic text-muted-foreground">
          No {label.toLowerCase()} set
        </p>
      )}
    </div>
  );
}

function AttrBar({
  label,
  value,
  proficient,
}: {
  label: string;
  value: number;
  proficient: boolean;
}) {
  // Display range -1..5; sum exactly 10
  const clamped = Math.max(-1, Math.min(5, value));
  return (
    <div
      className={[
        "rounded-md border p-3",
        proficient
          ? "border-primary bg-primary/10"
          : "border-border bg-card",
      ].join(" ")}
    >
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
        {proficient && (
          <span className="ml-1.5 font-semibold text-primary">★ Proficient</span>
        )}
      </p>
      <p className="mt-1 font-mono text-2xl font-bold tabular-nums">
        {clamped >= 0 ? `+${clamped}` : clamped}
      </p>
    </div>
  );
}