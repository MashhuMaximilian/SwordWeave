// =============================================================================
// GET /api/icons/blob/[...path]
//
// Clerk-authenticated proxy for user-uploaded icon files stored in
// private Vercel Blob (or local disk during development). Blob is PRIVATE so its
// URLs are not directly fetchable — every request must come through
// this proxy which authenticates the viewer first.
//
// Access follows the current entry's visibility, including anonymous public
// viewers and direct character shares. Owners may preview unattached uploads.
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

import { canReadUploadedArtwork } from "@/lib/assets/upload-access";
import { auth } from "@clerk/nextjs/server";
import { type NextRequest, NextResponse } from "next/server";
import { get } from "@vercel/blob";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

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

  const { path } = await ctx.params;
  const pathname = (path ?? []).join("/");
  if (!isAllowedPath(pathname)) {
    return new NextResponse("Not found", { status: 404 });
  }

  if (!(await canReadUploadedArtwork(pathname, clerkUserId))) {
    return new NextResponse("Not found", { status: 404 });
  }

  if (process.env.NODE_ENV === "development" && !process.env["BLOB_READ_WRITE_TOKEN"]) {
    try {
      const bytes = await readFile(join(process.cwd(), ".local-uploads", pathname));
      const extension = pathname.split(".").pop()?.toLowerCase();
      const contentType = extension === "jpg" || extension === "jpeg" ? "image/jpeg"
        : extension === "png" ? "image/png"
        : extension === "webp" ? "image/webp"
        : extension === "gif" ? "image/gif"
        : extension === "svg" ? "image/svg+xml" : "application/octet-stream";
      return new NextResponse(bytes, { headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'",
      } });
    } catch {
      return new NextResponse("Not found", { status: 404 });
    }
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
