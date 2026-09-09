// =============================================================================
// with-character-snapshot — PLAN Eilxina Part E (Mashu 2026-09-09).
//
// Tiny wrapper that runs a save-route's work, then captures a
// characterVersions snapshot of the resulting state. Snapshot
// failures are LOGGED but never fail the user's edit — the
// snapshot is a safety net, not the canonical write.
//
// Why a wrapper (not a per-route import):
//   - Centralizes the trigger policy (see capture-character-snapshot.ts)
//   - Centralizes error handling (snapshot failure ≠ edit failure)
//   - Lets routes stay focused on their primary mutation
//
// Usage:
//
//   export async function POST(request, { params }) {
//     try {
//       await resolveCharacterAccess(userId, characterId, { require: "OWNER" });
//       await withCharacterSnapshot(characterId, async () => {
//         await db.update(characters)...;
//         await db.insert(characterPrimitives)...;
//       }, { publishedByUserId: clerkUserId });
//       return NextResponse.json({ ok: true });
//     } catch ...
//   }
//
// Note: captureCharacterSnapshot reads the FRESH DB state after
// `work()` returns. The function is intentionally NOT inside the
// route's transaction — capturing the snapshot in the same tx as
// the edit would couple write success to snapshot success, and we
// want them independent (snapshot is a safety net).
// =============================================================================

import { captureCharacterSnapshot } from "./capture-character-snapshot";

export interface WithCharacterSnapshotArgs {
  /** Clerk user id of the editor — recorded as `publishedByUserId`
   *  on the version row. null = system (no caller on record). */
  publishedByUserId?: string | null;
}

export async function withCharacterSnapshot(
  characterId: string,
  work: () => Promise<unknown>,
  args?: WithCharacterSnapshotArgs | undefined,
): Promise<void> {
  // Run the primary work first.
  await work();

  // Snapshot AFTER work so the captured state reflects the edit.
  // Snapshot failures are logged but never propagated — the edit
  // itself succeeded, the safety net is a nice-to-have.
  try {
    await captureCharacterSnapshot({
      characterId,
      publishedByUserId: args?.publishedByUserId ?? null,
    });
  } catch (err) {
    console.error(
      `[withCharacterSnapshot] failed for ${characterId}:`,
      err,
    );
  }
}
