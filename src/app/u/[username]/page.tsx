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
import { listByForker } from "@/lib/publishing/forks-query";
import { ForkEntry } from "@/lib/publishing/forks-query";
import { FollowButton } from "@/components/profile/follow-button";

export const dynamic = "force-dynamic";

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const { userId: viewerClerkId } = await auth();

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
                value={profile.stats.totalForksCreated}
              />
              <Stat
                label="Net likes"
                value={
                  profile.stats.totalLikesReceived -
                  profile.stats.totalDislikesReceived
                }
              />
            </div>
          </div>
        </div>
      </div>

      <PublicEntriesSection
        userId={profile.id}
        clerkUserId={profile.clerkUserId ?? null}
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

async function PublicEntriesSection({
  userId,
  clerkUserId,
}: {
  userId: string;
  clerkUserId: string | null;
}) {
  // Look up the user to see if they have any public entries yet.
  const userRow = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { username: true },
  });
  if (!userRow) return null;

  // Fetch recent forks this user created
  const recentForks = clerkUserId ? await listByForker(clerkUserId, 10) : [];

  return (
    <section className="mt-8 rounded-2xl border border-sword-border bg-sword-surface p-6">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-sword-fg">
        <Globe className="h-5 w-5 text-sword-accent" /> Public entries
      </h2>
      <p className="mt-2 text-sm text-sword-muted">
        Primitives, capabilities, characters, items, and heritage by{" "}
        @{userRow.username} will appear here once they publish to the Library.
      </p>

      {recentForks.length > 0 && (
        <div className="mt-6 border-t border-sword-border pt-6">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-sword-fg">
            <GitFork className="h-4 w-4 text-sword-accent" />
            Recent forks ({recentForks.length})
          </h3>
          <ul className="mt-3 divide-y divide-sword-border/60 text-sm">
            {recentForks.map((fork) => (
              <RecentForkRow key={fork.id} fork={fork} />
            ))}
          </ul>
        </div>
      )}

      {recentForks.length === 0 && (
        <div className="mt-6 flex flex-col items-center gap-3 rounded-md border border-dashed border-sword-border/60 bg-sword-bg/40 px-4 py-8 text-center">
          <Library className="h-6 w-6 text-sword-muted" aria-hidden="true" />
          <p className="text-sm text-sword-muted">
            @{userRow.username} hasn&apos;t published anything yet — and has no
            forks to show.
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

function RecentForkRow({ fork }: { fork: ForkEntry }) {
  const targetLabel =
    fork.forkedTargetName ?? `(${fork.forkedTargetType.toLowerCase()})`;
  const sourceLabel =
    fork.sourceTargetName ?? `(${fork.sourceTargetType.toLowerCase()})`;
  const linkPath = `/library/item/${fork.forkedTargetType}:${fork.forkedTargetId}`;

  return (
    <li className="flex flex-wrap items-center gap-x-2 gap-y-1 py-2">
      <Link
        href={linkPath}
        className="font-medium text-sword-fg hover:text-sword-accent"
      >
        {targetLabel}
      </Link>
      <span className="text-sword-muted">forked from</span>
      <Link
        href={`/library/item/${fork.sourceTargetType}:${fork.sourceTargetId}`}
        className="text-sword-muted hover:text-sword-fg"
      >
        {sourceLabel}
      </Link>
      <span className="ml-auto text-xs text-sword-muted">
        {timeAgo(fork.forkedAt)}
      </span>
    </li>
  );
}

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}