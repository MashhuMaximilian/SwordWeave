import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import {
  ArrowLeft,
  Edit3,
  GitFork,
  Globe,
  Library,
  Link as LinkIcon,
  Settings,
  Users,
} from "lucide-react";
import { db } from "@/db/client";
import { users } from "@/db/schema/profiles";
import { eq } from "drizzle-orm";
import { loadProfileByUsername } from "@/lib/profiles/profile-loader";
import { queryLibrary } from "@/lib/publishing/library-query";
import { FollowButton } from "@/components/profile/follow-button";
import { ProfileFilterChips } from "@/components/profile/profile-filter-chips";

export const dynamic = "force-dynamic";

export default async function ProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ kind?: string; visibility?: string }>;
}) {
  const { username } = await params;
  const sp = await searchParams;
  const { userId: viewerClerkId } = await auth();
  // Phase 9 follow-up: parse the kind + visibility URL params for the
  // profile filter chips. The chips push these back as ?kind=<>&visibility=<>
  // and the server reads them on render.
  const kindFilter: "fork" | "creation" | undefined =
    sp.kind === "fork" || sp.kind === "creation" ? sp.kind : undefined;
  const visibilityFilter:
    | "PUBLIC"
    | "FOLLOWERS_ONLY"
    | undefined =
    sp.visibility === "public"
      ? "PUBLIC"
      : sp.visibility === "followers"
        ? "FOLLOWERS_ONLY"
        : undefined;

  const profile = await loadProfileByUsername(username, viewerClerkId);

  // Username was renamed → redirect to the new canonical URL.
  if (
    profile &&
    profile.username.toLowerCase() !== username.toLowerCase()
  ) {
    redirect(`/u/${profile.username}`);
  }

  if (!profile) {
    notFound();
  }

  // Phase 9 follow-up: query the user's authored content via queryLibrary.
  // Previously the profile showed "forks" by joining `forks` table —
  // but the atelier fork path never wrote rows there, so the list was
  // empty for every user. Now we query entity tables directly via the
  // new `authorClerkId` + `kind` filters. This surfaces BOTH forks and
  // creations regardless of how they were created.
  const userClerkId = profile.clerkUserId ?? null;
  const profileItems = userClerkId
    ? await queryLibrary({
        authorClerkId: userClerkId,
        ...(kindFilter && { kind: kindFilter }),
        ...(visibilityFilter && { visibility: visibilityFilter }),
        limit: 100,
      })
    : { items: [] as Array<Record<string, unknown>> };

  const items = (profileItems.items as unknown) as Array<{
    id: string;
    name: string;
    targetType: string;
    visibility?: "PRIVATE" | "FOLLOWERS_ONLY" | "PUBLIC";
    sourceOrigin: string | null;
  }>;
  const forkCount = items.filter((it) => it.sourceOrigin?.startsWith("fork:"))
    .length;
  const creationCount = items.length - forkCount;

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-8">
      <Link
        href="/"
        className="mb-4 inline-flex items-center gap-1 text-sm text-sword-muted hover:text-sword-fg"
      >
        <ArrowLeft className="h-4 w-4" /> Home
      </Link>

      <div className="rounded-2xl border border-sword-border bg-sword-surface p-6">
        <div className="flex flex-col gap-6 md:flex-row md:items-start">
          <Avatar
            src={profile.avatarUrl}
            alt={profile.displayName ?? profile.username}
            fallback={profile.username}
          />

          <div className="flex-1">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="font-display mt-3 text-4xl font-semibold uppercase leading-tight tracking-wide">{profile.displayName ?? `@${profile.username}`}</h1>
                <p className="text-sm text-sword-muted">@{profile.username}</p>
              </div>

              <div className="flex items-center gap-2">
                {!profile.isOwner && viewerClerkId && (
                  <FollowButton
                    targetUserId={profile.id}
                    initialFollowing={profile.viewerIsFollowing}
                  />
                )}
                {profile.isOwner && (
                  <Link
                    href="/settings/profile"
                    className="inline-flex items-center gap-1 rounded-md border border-sword-border bg-sword-bg px-3 py-1.5 text-sm text-sword-fg hover:bg-sword-surface"
                  >
                    <Settings className="h-4 w-4" /> Edit profile
                  </Link>
                )}
              </div>
            </div>

            {profile.bio && (
              <p className="mt-3 text-sword-fg">{profile.bio}</p>
            )}

            <SocialLinks links={profile.socialLinks} />

            <div className="mt-5 flex flex-wrap gap-4 text-sm text-sword-muted">
              <Stat label="Followers" value={profile.stats.followersCount} />
              <Stat label="Following" value={profile.stats.followingCount} />
              <Stat
                label="Public entries"
                value={
                  profile.stats.publicPrimitives +
                  profile.stats.publicCapabilities +
                  profile.stats.publicCharacters +
                  profile.stats.publicItems +
                  profile.stats.publicRaces +
                  profile.stats.publicBackgrounds +
                  profile.stats.publicArchetypes
                }
              />
              <Stat
                label="Forks received"
                value={profile.stats.totalForksReceived}
              />
              <Stat
                label="Forks created"
                value={forkCount}
              />
              <Stat
                label="Net likes"
                value={
                  profile.stats.totalLikesReceived - profile.stats.totalDislikesReceived
                }
              />
            </div>
          </div>
        </div>
      </div>

      <ProfileEntriesSection
        userId={profile.id}
        clerkUserId={profile.clerkUserId ?? null}
        items={items}
      />
    </div>
  );
}

function Avatar({
  src,
  alt,
  fallback,
}: {
  src: string | null;
  alt: string;
  fallback: string;
}) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={src}
        alt={alt}
        className="h-24 w-24 shrink-0 rounded-full border border-sword-border object-cover"
      />
    );
  }
  const letter = fallback[0]?.toUpperCase() ?? "?";
  return (
    <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full border border-sword-border bg-sword-bg text-3xl font-bold text-sword-accent">
      {letter}
    </div>
  );
}

function SocialLinks({
  links,
}: {
  links: {
    twitter?: string;
    mastodon?: string;
    bluesky?: string;
    discord?: string;
    website?: string;
    itch?: string;
    instagram?: string;
    youtube?: string;
    drivethrurpg?: string;
    patreon?: string;
    buymeacoffee?: string;
  };
}) {
  const entries = Object.entries(links).filter(([, v]) => !!v);
  if (entries.length === 0) return null;
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {entries.map(([k, v]) => (
        <a
          key={k}
          href={v as string}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-full border border-sword-border bg-sword-bg px-3 py-1 text-xs text-sword-fg hover:bg-sword-surface"
        >
          <LinkIcon className="h-3 w-3" />
          {k}
        </a>
      ))}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline gap-1">
      <span className="font-mono text-base text-sword-fg">{value}</span>
      <span>{label}</span>
    </div>
  );
}

async function ProfileEntriesSection({
  userId,
  items,
}: {
  userId: string;
  clerkUserId: string | null;
  items: Array<{
    id: string;
    name: string;
    targetType: string;
    visibility?: "PRIVATE" | "FOLLOWERS_ONLY" | "PUBLIC";
    sourceOrigin: string | null;
  }>;
}) {
  // Look up the username to render the empty-state copy.
  const userRow = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { username: true },
  });
  if (!userRow) return null;

  return (
    <section className="mt-8 rounded-2xl border border-sword-border bg-sword-surface p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-sword-fg">
          <Globe className="h-5 w-5 text-sword-accent" /> Public entries
        </h2>
        <span className="text-xs text-sword-muted">
          {items.length} {items.length === 1 ? "item" : "items"}
        </span>
      </div>
      <ProfileFilterChips
        basePath={`/u/${userRow.username}`}
        kind="all"
        visibility="all"
      />

      {items.length > 0 ? (
        <ul className="mt-4 divide-y divide-sword-border/60 text-sm">
          {items.map((it) => (
            <ProfileEntryRow key={it.id} item={it} />
          ))}
        </ul>
      ) : (
        <div className="mt-6 flex flex-col items-center gap-3 rounded-md border border-dashed border-sword-border/60 bg-sword-bg/40 px-4 py-8 text-center">
          <Library className="h-6 w-6 text-sword-muted" aria-hidden="true" />
          <p className="text-sm text-sword-muted">
            @{userRow.username} hasn&apos;t authored any matching entries yet.
          </p>
          <Link
            href="/library/browse"
            className="text-xs font-medium text-sword-accent hover:underline"
          >
            Browse the library →
          </Link>
        </div>
      )}
    </section>
  );
}

function ProfileEntryRow({
  item,
}: {
  item: {
    id: string;
    name: string;
    targetType: string;
    visibility?: "PRIVATE" | "FOLLOWERS_ONLY" | "PUBLIC";
    sourceOrigin: string | null;
  };
}) {
  const isFork = item.sourceOrigin?.startsWith("fork:") ?? false;
  const linkPath = `/library/item/${item.id.split(":")[0]}:${item.id.split(":")[1] ?? ""}`;
  return (
    <li className="flex flex-wrap items-center gap-x-2 gap-y-1 py-2">
      <Link
        href={linkPath}
        className="font-medium text-sword-fg hover:text-sword-accent"
      >
        {item.name}
      </Link>
      <span className="rounded-full bg-sword-bg px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-sword-muted">
        {item.targetType.toLowerCase().replace("_template", "")}
      </span>
      {isFork ? (
        <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-accent">
          Fork
        </span>
      ) : null}
      {item.visibility && item.visibility !== "PRIVATE" ? (
        <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-secondary-foreground">
          {item.visibility === "PUBLIC" ? "Public" : "Followers"}
        </span>
      ) : null}
    </li>
  );
}