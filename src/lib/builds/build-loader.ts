// =============================================================================
// Build query service — Phase 6.5 #17
//
// Loads public-facing build data for the /library/builds/[id] page.
// Builds are characters-in-progress: they have race, background, archetype,
// attribute distribution, and capability links but no level-up history.
//
// Returns null if the build doesn't exist or isn't public (unless viewer is
// the owner — caller decides).
// =============================================================================

import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  buildCapabilities,
  builds,
  capabilities,
  templates,
  users,
} from "@/db/schema";

export interface PublicBuild {
  id: string;
  name: string;
  description: string | null;
  level: number;
  startingBu: number;
  isArchetypeTemplate: boolean;
  race: { id: string; name: string; description: string | null } | null;
  background: { id: string; name: string; description: string | null } | null;
  archetype: { id: string; name: string; description: string | null } | null;
  attributes: {
    physical: number;
    mental: number;
    magical: number;
    proficient: "PHYSICAL" | "MENTAL" | "MAGICAL" | null;
  };
  portraitUrl: string | null;
  author: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
    isAnonymized: boolean;
  } | null;
  capabilities: Array<{
    id: string;
    name: string;
    type: string;
    verboseDescription: string;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

export async function loadPublicBuild(
  id: string,
  opts: { includePrivateForUserId?: string | null } = {},
): Promise<PublicBuild | null> {
  const row = await db.query.builds.findFirst({
    where: eq(builds.id, id),
    with: {
      race: true,
      background: true,
      capabilityLinks: {
        with: { capability: true },
      },
    },
  });
  if (!row) return null;

  // Visibility: must be public, OR the caller owns it
  if (!row.isPublic && row.userId !== opts.includePrivateForUserId) {
    return null;
  }

  // Resolve author (Clerk user id → internal users row)
  let author: PublicBuild["author"] = null;
  if (row.userId) {
    const userRow = await db.query.users.findFirst({
      where: eq(users.clerkUserId, row.userId),
      columns: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        isAnonymized: true,
      },
    });
    if (userRow) {
      author = {
        id: userRow.id,
        username: userRow.username,
        displayName: userRow.displayName,
        avatarUrl: userRow.avatarUrl,
        isAnonymized: userRow.isAnonymized ?? false,
      };
    }
  }

  // Resolve archetype: looks up the template referenced by the linked
  // archetype capability (builds.archetypeName is a snapshot, but the
  // canonical template lives in the templates table).
  let archetype: PublicBuild["archetype"] = null;
  // For now, archetypes aren't linked via FK on builds — derive from
  // capabilityLinks where capability.type = 'ARCHETYPE'. We don't have
  // that enum value guaranteed here, so leave null unless we find one.
  // Future: link builds.archetypeId -> templates.id.

  // Hydrate capabilityLinks → capability rows
  const caps = (row.capabilityLinks ?? [])
    .map((link) => link.capability)
    .filter((c): c is NonNullable<typeof c> => Boolean(c));

  // Attribute defaults: build stores them as integer columns. Default to
  // 0 when null (server enforces 10 total on insert, so this shouldn't
  // happen for public rows, but defend anyway).
  const attrs = {
    physical: row.attrPhysical ?? 0,
    mental: row.attrMental ?? 0,
    magical: row.attrMagical ?? 0,
    proficient: row.attrProficient ?? null,
  };

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    level: row.level,
    startingBu: row.startingBu,
    isArchetypeTemplate: row.isArchetypeTemplate,
    race: row.race
      ? {
          id: row.race.id,
          name: row.race.name,
          description: row.race.description,
        }
      : null,
    background: row.background
      ? {
          id: row.background.id,
          name: row.background.name,
          description: row.background.description,
        }
      : null,
    archetype,
    attributes: attrs,
    portraitUrl: row.portraitUrl,
    author,
    capabilities: caps.map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      verboseDescription: c.verboseDescription,
    })),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}