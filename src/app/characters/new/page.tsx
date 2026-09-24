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
    <main className="sw-forge-page">
      <header className="sw-forge-page__masthead">
        <Link href="/characters" className="sw-forge-page__back">
          <ArrowLeft aria-hidden /> Back to characters
        </Link>
        <div>
          <span>Character creation</span>
          <h1>Forge a new character</h1>
          <p>Establish identity, attributes, story, and starting mechanical access before entering the character sheet.</p>
        </div>
      </header>
      <NewCharacterForm />
    </main>
  );
}
