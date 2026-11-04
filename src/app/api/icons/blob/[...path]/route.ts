// Authorize against current artwork references before reading private storage.

import { canReadUploadedArtwork } from "@/lib/assets/upload-access";
import { readPrivateUpload } from "@/lib/assets/private-upload-store";
import { isUploadKey } from "@/lib/assets/upload-path";
import { auth } from "@clerk/nextjs/server";
import { type NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const { userId: clerkUserId } = await auth();

  const { path } = await ctx.params;
  const pathname = (path ?? []).join("/");
  if (!isUploadKey(pathname)) {
    return new NextResponse("Not found", { status: 404 });
  }

  if (!(await canReadUploadedArtwork(pathname, clerkUserId))) {
    return new NextResponse("Not found", { status: 404 });
  }

  let blob;
  try {
    blob = await readPrivateUpload(pathname, req.signal);
  } catch {
    console.error("[api/icons/blob] private read failed");
    return new NextResponse("Upstream error", { status: 502 });
  }
  if (!blob) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(blob.stream, {
    headers: {
      "Content-Type": blob.contentType,
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
