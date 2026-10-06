/** Guided first-character flow. The Atelier keeps its separate sandbox modal. */

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
    <main className="sw-forge-page sw-player-creation">
      <header className="sw-forge-page__masthead">
        <Link href="/characters" className="sw-forge-page__back">
          <ArrowLeft aria-hidden /> Back to characters
        </Link>
        <div>
          <span>Character creation</span>
          <h1>Forge a new character</h1>
          <p>Take your time with a complete character, or choose ready heritages in Quickbuild and start playing. Both paths stay open to new ideas on the character sheet.</p>
        </div>
      </header>
      <NewCharacterForm />
    </main>
  );
}
