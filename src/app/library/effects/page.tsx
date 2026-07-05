// =============================================================================
// /library/effects — legacy list page
//
// Redirects to /library/browse?type=EFFECT so all entity types share one
// list UI.
// =============================================================================

import { redirect } from "next/navigation";

export default function LibraryEffectsPage() {
  redirect("/library/browse?type=EFFECT");
}