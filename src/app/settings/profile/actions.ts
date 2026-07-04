"use server";

/**
 * Profile update server actions. Used by /settings/profile page.
 *
 * Auth: Clerk's auth() returns the viewer's clerk user id; we look up the
 * SwordWeave profile by clerk_user_id and verify the actor owns it.
 */
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/client";
import { users } from "@/db/schema/profiles";
import { renameUsername } from "@/lib/profiles/lookup";
import { validateUsername } from "@/lib/profiles/username";

export type UpdateProfileResult =
  | { ok: true }
  | {
      ok: false;
      field: "displayName" | "bio" | "avatarUrl" | "socialLinks" | "username";
      error: string;
    };

interface SocialLinksInput {
  twitter?: string;
  mastodon?: string;
  bluesky?: string;
  discord?: string;
  website?: string;
  itch?: string;
  instagram?: string;
  youtube?: string;
  drivethrurpg?: string;
  patreon?: string;
  buymeacoffee?: string;
}

const BIO_MAX = 500;
const DISPLAY_NAME_MAX = 64;

export async function updateProfile(input: {
  displayName?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
  socialLinks?: SocialLinksInput;
}): Promise<UpdateProfileResult> {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) {
    return { ok: false, field: "displayName", error: "Not signed in" };
  }

  const profile = await db.query.users.findFirst({
    where: eq(users.clerkUserId, clerkUserId),
    columns: { id: true, username: true },
  });
  if (!profile) {
    return { ok: false, field: "displayName", error: "Profile not found" };
  }

  if (input.displayName !== undefined) {
    if (input.displayName && input.displayName.length > DISPLAY_NAME_MAX) {
      return {
        ok: false,
        field: "displayName",
        error: `Display name must be ${DISPLAY_NAME_MAX} characters or fewer`,
      };
    }
  }
  if (input.bio !== undefined && input.bio && input.bio.length > BIO_MAX) {
    return {
      ok: false,
      field: "bio",
      error: `Bio must be ${BIO_MAX} characters or fewer`,
    };
  }
  if (input.avatarUrl !== undefined && input.avatarUrl) {
    try {
      new URL(input.avatarUrl);
    } catch {
      return { ok: false, field: "avatarUrl", error: "Invalid avatar URL" };
    }
  }
  if (input.socialLinks) {
    for (const [platform, url] of Object.entries(input.socialLinks)) {
      if (!url) continue;
      try {
        const parsed = new URL(url);
        if (!["http:", "https:"].includes(parsed.protocol)) {
          return {
            ok: false,
            field: "socialLinks",
            error: `${platform} URL must use http or https`,
          };
        }
      } catch {
        return {
          ok: false,
          field: "socialLinks",
          error: `Invalid URL for ${platform}`,
        };
      }
    }
  }

  await db
    .update(users)
    .set({
      displayName: input.displayName ?? null,
      bio: input.bio ?? null,
      avatarUrl: input.avatarUrl ?? null,
      socialLinks: input.socialLinks ?? {},
      updatedAt: new Date(),
    })
    .where(eq(users.id, profile.id));

  revalidatePath(`/u/${profile.username}`);
  revalidatePath("/settings/profile");
  return { ok: true };
}

export async function updateUsername(
  newUsernameRaw: string,
): Promise<UpdateProfileResult> {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) {
    return { ok: false, field: "username", error: "Not signed in" };
  }

  const validation = validateUsername(newUsernameRaw);
  if (!validation.valid || !validation.normalized) {
    return {
      ok: false,
      field: "username",
      error: validation.errorMessage ?? "Invalid username",
    };
  }

  const profile = await db.query.users.findFirst({
    where: eq(users.clerkUserId, clerkUserId),
    columns: { id: true, username: true },
  });
  if (!profile) {
    return { ok: false, field: "username", error: "Profile not found" };
  }

  const result = await renameUsername(profile.id, validation.normalized);
  if (!result.ok) {
    return {
      ok: false,
      field: "username",
      error: result.errorMessage ?? "Rename failed",
    };
  }

  revalidatePath(`/u/${profile.username}`);
  revalidatePath("/settings/profile");
  return { ok: true };
}

export async function loadCurrentProfile(): Promise<{
  id: string;
  username: string;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  socialLinks: SocialLinksInput;
} | null> {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return null;

  const row = await db.query.users.findFirst({
    where: eq(users.clerkUserId, clerkUserId),
    columns: {
      id: true,
      username: true,
      displayName: true,
      bio: true,
      avatarUrl: true,
      socialLinks: true,
    },
  });
  if (!row) return null;

  return {
    id: row.id,
    username: row.username,
    displayName: row.displayName,
    bio: row.bio,
    avatarUrl: row.avatarUrl,
    socialLinks: (row.socialLinks as SocialLinksInput) ?? {},
  };
}