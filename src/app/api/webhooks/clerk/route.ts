/**
 * POST /api/webhooks/clerk
 *
 * Receives Clerk webhook events for user lifecycle:
 *   - user.created  → create SwordWeave profile (username from Clerk)
 *   - user.updated  → sync display name, avatar, username changes
 *   - user.deleted  → soft-delete the SwordWeave profile (30-day grace)
 *
 * Signature verified via @clerk/nextjs/webhooks (Svix under the hood).
 * Reads CLERK_WEBHOOK_SIGNING_SECRET env var automatically.
 */
import { NextResponse, type NextRequest } from "next/server";
import { verifyWebhook } from "@clerk/nextjs/webhooks";
import {
  anonymizeUser,
  createProfileFromClerk,
  renameUsername,
  softDeleteUser,
} from "@/lib/profiles/lookup";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema/profiles";

export const runtime = "nodejs"; // need Node crypto, not Edge
export const dynamic = "force-dynamic";

interface ClerkUsernameJSON {
  username: string | null;
}

interface ClerkUserJSON {
  id: string;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  image_url: string | null;
  primary_email_address_id: string | null;
  email_addresses: Array<{
    id: string;
    email_address: string;
  }>;
}

interface ClerkUserDeletedJSON {
  id: string;
  deleted: boolean;
}

export async function POST(req: NextRequest): Promise<Response> {
  let evt;
  try {
    evt = await verifyWebhook(req);
  } catch (err) {
    console.error("[clerk-webhook] signature verification failed:", err);
    return new NextResponse("Invalid signature", { status: 400 });
  }

  try {
    switch (evt.type) {
      case "user.created":
      case "user.updated": {
        const data = evt.data as ClerkUserJSON;
        const username = data.username ?? "";
        const displayName =
          [data.first_name, data.last_name].filter(Boolean).join(" ") || null;
        const avatarUrl = data.image_url ?? null;

        // Check if profile already exists by Clerk id
        const existing = await db.query.users.findFirst({
          where: eq(users.clerkUserId, data.id),
          columns: { id: true, username: true },
        });

        if (existing) {
          // Update path: handle username change, display name, avatar.
          // username_history redirects will preserve old URLs.
          if (existing.username !== username.toLowerCase() && username) {
            await renameUsername(existing.id, username);
          }
          await db
            .update(users)
            .set({ displayName, avatarUrl })
            .where(eq(users.id, existing.id));
          return NextResponse.json({ ok: true, action: "updated" });
        }

        // Create path — Clerk requires username at signup so it should be
        // present here. If for some reason it's missing, fail loudly so we
        // notice in logs rather than silently creating a broken profile.
        if (!username) {
          console.warn(
            `[clerk-webhook] user.created without username (clerk id ${data.id})`,
          );
          return NextResponse.json(
            { ok: false, reason: "missing-username" },
            { status: 422 },
          );
        }

        const result = await createProfileFromClerk({
          clerkUserId: data.id,
          username,
          displayName,
          avatarUrl,
        });
        if (!result.ok) {
          console.error(
            `[clerk-webhook] profile creation failed for ${data.id}:`,
            result.error,
            result.errorMessage,
          );
          // 409 for username taken, 400 for invalid
          const status = result.error === "USERNAME_TAKEN" ? 409 : 400;
          return NextResponse.json(
            { ok: false, error: result.error, errorMessage: result.errorMessage },
            { status },
          );
        }
        return NextResponse.json({ ok: true, action: "created", userId: result.userId });
      }

      case "user.deleted": {
        const data = evt.data as ClerkUserDeletedJSON;
        const existing = await db.query.users.findFirst({
          where: eq(users.clerkUserId, data.id),
          columns: { id: true },
        });
        if (!existing) {
          // Already gone — fine, idempotent
          return NextResponse.json({ ok: true, action: "noop" });
        }
        const result = await softDeleteUser(existing.id);
        return NextResponse.json({
          ok: true,
          action: "soft-deleted",
          purgeAfter: result.purgeAfter?.toISOString() ?? null,
        });
      }

      default:
        // Unhandled event types are 200 OK so Clerk doesn't retry. We only
        // care about user lifecycle for now.
        return NextResponse.json({ ok: true, action: "ignored", type: evt.type });
    }
  } catch (err) {
    console.error("[clerk-webhook] handler error:", err);
    return NextResponse.json({ ok: false, error: "internal" }, { status: 500 });
  }
}

/**
 * Anonymize all users whose grace period has expired. Designed to be called
 * from a Vercel Cron job — for now we expose it as a POST endpoint the
 * operator can hit, or the cron can hit.
 */
export async function GET(): Promise<Response> {
  // Health check
  return NextResponse.json({ ok: true, endpoint: "clerk-webhook" });
}

// Allow the anonymize helper to be re-exported for cron use
export { anonymizeUser };