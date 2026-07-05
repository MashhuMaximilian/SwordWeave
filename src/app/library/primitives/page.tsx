// =============================================================================
// /library/primitives — legacy list page
//
// Redirects to /library/browse?type=PRIMITIVE so all entity types share one
// list UI. The view component below is kept for reference but no longer
// rendered.
// =============================================================================

import { redirect } from "next/navigation";

export default function LibraryPrimitivesPage() {
  redirect("/library/browse?type=PRIMITIVE");
}