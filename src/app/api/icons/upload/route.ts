// Authenticated image uploads use the viewer-owned key and return a same-site proxy URL.

import { auth } from "@clerk/nextjs/server";
import { type NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { MAX_UPLOAD_BYTES, writePrivateUpload } from "@/lib/assets/private-upload-store";

export const dynamic = "force-dynamic";

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
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: `File too large; max ${MAX_UPLOAD_BYTES} bytes` },
      { status: 413 },
    );
  }
  const ext = MIME_TO_EXT[file.type];
  if (!ext || !Object.hasOwn(MIME_TO_EXT, file.type)) {
    return NextResponse.json(
      { error: `Unsupported MIME type: ${file.type}` },
      { status: 415 },
    );
  }

  const pathname = `user-uploads/${clerkUserId}/${randomUUID()}.${ext}`;
  try {
    await writePrivateUpload(pathname, file, req.signal);
  } catch {
    console.error("[api/icons/upload] private upload failed");
    return NextResponse.json({ error: "Upload failed" }, { status: 502 });
  }

  return NextResponse.json({
    ok: true, pathname, url: `/api/icons/blob/${pathname}`, contentType: file.type, size: file.size,
  });
}
