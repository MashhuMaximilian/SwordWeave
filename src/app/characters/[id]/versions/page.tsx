// =============================================================================
// /characters/[id]/versions — PLAN Eilxina Part E (Mashu 2026-09-09).
//
// Thin wrapper that redirects to the existing /library/item page
// with a CHARACTER composite id. We don't duplicate the version
// history UI; the library version-history page already supports
// CHARACTER via the `CHARACTER:<id>` composite id (added back in
// the initial version-history page launch). This page is a
// convenience URL for the header Versions link on the character
// sheet.
//
// Auth: any viewer (the version history is read-only).
// =============================================================================

import { redirect } from "next/navigation";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CharacterVersionsPage({ params }: PageProps) {
  const { id } = await params;
  redirect(`/library/item/CHARACTER:${id}/versions`);
}
