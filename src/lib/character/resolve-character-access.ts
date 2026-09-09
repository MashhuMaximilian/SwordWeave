// =============================================================================
// resolve-character-access — PLAN Eilxina Part C (Mashu 2026-09-09).
//
// Convenience wrapper around canResolveCharacter() that adds:
//   - require: "OWNER" | "EDITOR" — gates to a specific permission level
//   - handleCharacterAccessError — catch-block helper for API routes
//
// Why split from can-resolve-character.ts: keeping the helper that
// throws / returns "OWNER" | "EDITOR" | "VIEWER" pure (no Next.js
// imports), and putting the route-coupling helpers in a separate
// module, prevents accidental Next.js coupling when the helper is
// reused by non-Next code (CLI tools, the page SC).
// =============================================================================

import { NextResponse } from "next/server";
import {
  canResolveCharacter,
  CharacterAccessDenied,
  type CharacterPermission,
  type ResolvedCharacter,
} from "@/lib/character/can-resolve-character";

export interface ResolveOptions {
  /** If set, the function throws when the resolved permission is
   *  below this level. Default: any access (OWNER | EDITOR | VIEWER). */
  require?: CharacterPermission;
}

export async function resolveCharacterAccess(
  clerkUserId: string | null,
  characterId: string,
  opts: ResolveOptions = {},
): Promise<ResolvedCharacter> {
  const resolved = await canResolveCharacter(clerkUserId, characterId);
  if (opts.require) {
    const rank: Record<CharacterPermission, number> = {
      OWNER: 2,
      EDITOR: 1,
      VIEWER: 0,
    };
    if (rank[resolved.permission] < rank[opts.require]) {
      throw new CharacterAccessDenied(characterId);
    }
  }
  return resolved;
}

/** Standard catch-block handler for character API routes. Returns
 *  a 403 on access denial, 500 on anything else. Logs the error. */
export function handleCharacterAccessError(e: unknown): NextResponse {
  if (e instanceof CharacterAccessDenied) {
    return NextResponse.json({ error: e.message }, { status: 403 });
  }
  console.error("[character API] unexpected error:", e);
  return NextResponse.json(
    { error: "Internal server error." },
    { status: 500 },
  );
}
