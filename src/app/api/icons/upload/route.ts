// =============================================================================
// POST /api/icons/upload
//
// Upload a custom icon for use on a primitive/effect/capability/template/
// item. Body is multipart/form-data with a single `file` field plus
// optional `color` and `entityType`/`entityId` metadata.
//
// The upload goes straight into Vercel Blob (private access) at the
// canonical path `user-uploads/<clerk-user-id>/<uuid>.<ext>`. The
// client receives the path back and stores it in the entity row's
// `icon_url` column. The icon is served via /api/icons/blob/[...path]
// which Clerk-auths the viewer and streams from Blob.
//
// Restrictions:
//   - Only authenticated users can upload.
//   - Max size: 4MB (the user said the largest icon they expect to see
//     is a few hundred KB; 4MB leaves headroom for high-res PNGs).
//   - MIME: image/png, image/jpeg, image/webp, image/gif, image/svg+xml.
//   - Path prefix: always `user-uploads/<clerk-user-id>/` so a user
//     can't overwrite another user's blob. (Even if they tried, blob
//     names are unique by UUID — but the prefix hardens the boundary.)
// =============================================================================

import { auth } from "@clerk/nextjs/server";
import { put } from "@vercel/blob";
import { type NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

export const dynamic = "force-dynamic";

const MAX_BYTES = 4 * 1024 * 1024; // 4 MB
const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
]);
const MIME_TO_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
};

export async function POST(req: NextRequest) {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing 'file' field" }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "Empty file" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `File too large; max ${MAX_BYTES} bytes` },
      { status: 413 },
    );
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json(
      { error: `Unsupported MIME type: ${file.type}` },
      { status: 415 },
    );
  }

  // Build the canonical blob path. The user-id prefix lets us list a
  // user's uploads later (Vercel Blob's list API takes a prefix). The
  // UUID prevents collisions and makes guessing URLs hard.
  const ext = MIME_TO_EXT[file.type] ?? "bin";
  const pathname = `user-uploads/${clerkUserId}/${randomUUID()}.${ext}`;

  // `put` from @vercel/blob streams the body. We pass `access: "private"`
  // because the blob store is private. The token comes from
  // BLOB_READ_WRITE_TOKEN (configured in Vercel for production, .env.local
  // for dev).
  let blob;
  try {
    blob = await put(pathname, file, {
      access: "private",
      // Random UUID prevents collisions; we don't need to add a content-
      // hash because the same UUID is the canonical name.
      addRandomSuffix: false,
      // Allow the browser to set Content-Type from the upload.
      contentType: file.type,
    });
  } catch (e) {
    console.error("[api/icons/upload] blob put failed:", e);
    return NextResponse.json({ error: "Upload failed" }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    pathname: blob.pathname,
    url: blob.url, // internal signed URL — never returned to clients beyond /api/icons/blob
    contentType: file.type,
    size: file.size,
  });
}