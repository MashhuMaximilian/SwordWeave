"use client";

// =============================================================================
// HomepageAuth — Sign in / Sign up CTAs for the homepage hero.
//
// Renders nothing when the user is signed in; renders two buttons (Sign in,
// Create an account) when signed out. The home page is a server component
// (for fast first paint + SEO), so this small client island handles the
// conditional auth-aware UI. The server passes `signedIn` as a prop so the
// first paint matches the auth state (no flash of the signed-out UI for
// signed-in users).
// =============================================================================

import Link from "next/link";
import { LogIn, UserPlus } from "lucide-react";

export function HomepageAuth({ signedIn }: { signedIn: boolean }) {
  if (signedIn) return null;
  return (
    <>
      <Link
        className="inline-flex h-10 items-center gap-2 rounded-md border border-primary/40 bg-primary/10 px-4 text-sm font-bold text-primary hover:bg-primary/20"
        href="/sign-in"
      >
        <LogIn className="size-4" /> Sign in
      </Link>
      <Link
        className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-card px-4 text-sm font-bold text-foreground hover:bg-accent"
        href="/sign-up"
      >
        <UserPlus className="size-4" /> Create an account
      </Link>
    </>
  );
}
