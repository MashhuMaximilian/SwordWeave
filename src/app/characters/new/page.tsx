/**
 * /characters/new — Phase 9.1 inline character-builder entry point.
 *
 * Mashu 2026-09-06: this page replaces the modal for the FIRST-TIME
 * character creation flow. The user wanted to skip the "pick heritage,
 * then pick primitive, then pick item" maze and just write a
 * character's identity, attributes, and backstory in one screen — then
 * land directly in BUILD mode where they can slot primitives onto the
 * accordions inline.
 *
 * What this page does NOT do (and why):
 *   - It does NOT slot primitives. The accordion-chips-first workflow
 *     is the point of BUILD mode on /characters/[id]; this page only
 *     collects the character's *foundation* (name, size, level, three
 *     attributes, proficient attribute, optional backstory freeform).
 *   - It does NOT open the modal. The modal still exists at /atelier
 *     for users who prefer the 7-tab flow (preservation contract).
 *
 * Save behavior:
 *   POST /api/characters with { name, size, level, attrs, attrProficient, backstory }
 *   → 201 with the new character row
 *   → client router.push("/characters/[id]?mode=BUILD")
 *
 * Auth: required. /atelier characters route is also auth-gated, and we
 * keep this one auth-gated so a signed-out user gets bounced to
 * /sign-in (preserves the Phase 8.2 "save attempts create a character"
 * guard rail).
 */

import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { NewCharacterForm } from "@/components/characters/new-character-form";

export const dynamic = "force-dynamic";

export default async function NewCharacterPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in?redirect_url=/characters/new");
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-10 sm:py-14">
      <Link
        href="/characters"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to roster
      </Link>
      <header className="mt-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          Phase 9.1 — Inline builder
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
          Forge a new character
        </h1>
        <p className="mt-4 text-base leading-7 text-muted-foreground">
          Set the foundation (name, attributes, identity, optional
          backstory). Once you save, you will land in BUILD mode where
          you can slot primitives onto the Lineage, Upbringing, Manifest,
          and Items accordions inline. You can also keep using the{" "}
          <Link
            href="/atelier"
            className="font-semibold text-primary underline-offset-4 hover:underline"
          >
            atelier modal
          </Link>{" "}
          for the classic 7-tab flow.
        </p>
      </header>

      <NewCharacterForm />
    </div>
  );
}
