// =============================================================================
// /library/capabilities — legacy list page
//
// Redirects to /library/browse?type=CAPABILITY so all entity types share one
// list UI.
// =============================================================================

import { redirect } from "next/navigation";

export default function LibraryCapabilitiesPage() {
  redirect("/library/browse?type=CAPABILITY");
}