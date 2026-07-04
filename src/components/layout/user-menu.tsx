"use client";

/**
 * UserMenu — replaces Clerk's <UserButton> with our own dropdown.
 *
 * Why custom?
 *   - The avatar+name block links to the user's SwordWeave profile (/u/<username>).
 *   - Display name comes from OUR DB, not Clerk's stale session data.
 *   - Shows "Manage account" (Clerk hosted UI) and "Sign out" without forcing
 *     users through a full redirect.
 */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUser, useClerk } from "@clerk/nextjs";
import { LogOut, Settings, User as UserIcon } from "lucide-react";

interface UserMenuProfile {
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export function UserMenu() {
  const router = useRouter();
  const { user, isSignedIn, isLoaded } = useUser();
  const { signOut, openUserProfile } = useClerk();
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState<UserMenuProfile | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Fetch the latest profile from our DB so display name + avatar
  // reflect edits made on /settings/profile (Clerk's session data is stale).
  useEffect(() => {
    if (!isSignedIn || !user) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/users/me", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as UserMenuProfile | null;
        if (!cancelled) setProfile(data);
      } catch {
        // Network blip — fall back to Clerk session data
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isSignedIn, user]);

  // Close dropdown on outside click + Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  if (!isLoaded) {
    return <div className="size-9 animate-pulse rounded-full bg-card" />;
  }
  if (!isSignedIn || !user) {
    return null; // AppShell handles signed-out state with SignIn/SignUp buttons
  }

  const clerkUsername =
    user.username ?? user.primaryEmailAddress?.emailAddress?.split("@")[0] ?? "user";
  // Prefer our DB profile when available (fresh display name + avatar),
  // fall back to Clerk session if the fetch is still loading or failed.
  const username = profile?.username ?? clerkUsername;
  const displayName =
    profile?.displayName ??
    ([user.firstName, user.lastName].filter(Boolean).join(" ") ||
      user.username ||
      clerkUsername);
  const avatarUrl = profile?.avatarUrl ?? user.imageUrl;

  const profileHref = `/u/${username}`;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        aria-label="Open account menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full border border-border bg-background p-1 pr-3 text-sm font-bold text-foreground transition-colors hover:border-primary"
      >
        <Avatar src={avatarUrl} alt={displayName} fallback={displayName} />
        <span className="hidden max-w-[8rem] truncate sm:inline">{displayName}</span>
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-72 overflow-hidden rounded-md border border-border bg-card text-card-foreground shadow-lg">
          <Link
            href={profileHref}
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 border-b border-border bg-shell px-4 py-3 hover:bg-panel"
          >
            <Avatar src={avatarUrl} alt={displayName} fallback={displayName} large />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">
                {displayName}
              </p>
              <p className="truncate text-xs text-muted-foreground">@{username}</p>
              <p className="mt-1 text-xs text-primary">View profile →</p>
            </div>
          </Link>

          <div className="grid">
            <Link
              href={profileHref}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-panel"
            >
              <UserIcon className="size-4" /> View profile
            </Link>
            <Link
              href="/settings/profile"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-panel"
            >
              <Settings className="size-4" /> Edit profile
            </Link>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                openUserProfile();
              }}
              className="flex items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-panel"
            >
              <Settings className="size-4" /> Manage account
            </button>
            <div className="my-1 border-t border-border" />
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                signOut(() => router.push("/"));
              }}
              className="flex items-center gap-2 px-4 py-2.5 text-left text-sm text-destructive hover:bg-panel"
            >
              <LogOut className="size-4" /> Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Avatar({
  src,
  alt,
  fallback,
  large = false,
}: {
  src: string | null | undefined;
  alt: string;
  fallback: string;
  large?: boolean;
}) {
  const size = large ? "size-10" : "size-7";
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        className={`${size} shrink-0 rounded-full border border-border object-cover`}
      />
    );
  }
  const letter = fallback[0]?.toUpperCase() ?? "?";
  return (
    <div
      className={`${size} flex shrink-0 items-center justify-center rounded-full border border-border bg-background text-xs font-bold text-primary`}
    >
      {letter}
    </div>
  );
}