// =============================================================================
// GET /api/icons/blob/[...path]
//
// Clerk-authenticated proxy for user-uploaded icon files stored in
// private Vercel Blob. The blob store is configured as PRIVATE so its
// URLs are not directly fetchable — every request must come through
// this proxy which authenticates the viewer first.
//
// Auth model: any signed-in user can view any uploaded icon. This is
// permissive because:
//   1. The icon is associated with an entity (primitive/effect/etc) and
//      the entity's visibility tier already gates who can see the
//      parent. The icon is rendered wherever the parent is rendered.
//   2. We could narrow this further to check "user can view the entity
//      that owns this icon" but that requires resolving the blob path
//      back to an entity row, which is messy. Per-row visibility comes
//      from the entity lookup, not the icon fetch.
//   3. Icons are uploaded BY a user and (for now) shown to anyone who
//      can see them. Same model as profile pictures.
//
// Defense:
//   - Path is validated against the upload allowlist prefix
//     (user-uploads/). Attempts to read other blob paths return 404.
//   - Vercel Blob's `get(pathname, { access: "private" })` returns a
//     signed redirect URL we use to stream the file — we never expose
//     that URL to the client.
//   - Cache-Control: private, no-store. Uploaded icons may be replaced
//     or deleted; we don't want a stale icon after the user updates
//     their primitive's icon.
// =============================================================================

import { auth } from "@clerk/nextjs/server";
import { type NextRequest, NextResponse } from "next/server";
import { get } from "@vercel/blob";

// Only paths under this prefix are served. Anything else returns 404.
// The upload route enforces this same prefix on write so we never end
// up with a blob outside the allowlist; this is belt-and-braces.
const ALLOWED_PREFIX = "user-uploads/";

function isAllowedPath(pathname: string): boolean {
  if (!pathname.startsWith(ALLOWED_PREFIX)) return false;
  // Reject traversal attempts and absolute paths.
  if (pathname.includes("..") || pathname.startsWith("/")) return false;
  // Must look like a real file with a recognized extension.
  return /\.(png|jpe?g|webp|gif|svg)$/i.test(pathname);
}

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { path } = await ctx.params;
  const pathname = (path ?? []).join("/");
  if (!isAllowedPath(pathname)) {
    return new NextResponse("Not found", { status: 404 });
  }

  let blob;
  try {
    blob = await get(pathname, { access: "private" });
  } catch (e) {
    console.error("[api/icons/blob] get failed:", e);
    return new NextResponse("Upstream error", { status: 502 });
  }

  if (!blob) {
    return new NextResponse("Not found", { status: 404 });
  }

  // Stream the body through. Vercel Blob's get() returns a Response-
  // compatible ReadableStream that we can pipe straight to the client.
  // The Content-Type comes from the blob's stored metadata; SVGs are
  // served as image/svg+xml, PNGs as image/png, etc.
  return new NextResponse(blob.stream, {
    headers: {
      "Content-Type": blob.blob.contentType ?? "application/octet-stream",
      // Private + no-store: the icon may be replaced/deleted by the
      // owner; we don't want a stale cached copy after that.
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      // Defense: never let a maliciously-uploaded SVG execute scripts.
      // SVGs can contain <script> tags; we don't sanitize on upload
      // (would break legitimate SVGs), so we mitigate at serve time.
      // Browsers honor this for `<img src>` and `background-image`
      // contexts but NOT for `<object>` or direct navigation. The icon
      // is always rendered via `<img>` in our <IconDisplay> component,
      // which makes script execution impossible regardless of this
      // header — but we set it as defense in depth.
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'",
    },
  });
}