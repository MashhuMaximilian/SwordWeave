import { privateJson } from "@/lib/http/private-json";
import { auth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import { z } from "zod";
import { collectionContents } from "@/lib/collections/service";
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  const { id } = await params;
  const input = z
    .object({
      entries: z
        .array(z.object({ targetType: z.string(), targetId: z.string() }))
        .max(500),
    })
    .safeParse(await req.json().catch(() => null));
  if (!input.success)
    return privateJson({ error: "Invalid entries" }, { status: 400 });
  try {
    if (!input.data.entries.length) return privateJson({ entries: [] });
    const result = await collectionContents(
      id,
      userId,
      0,
      input.data.entries,
      500,
    );
    return privateJson({ entries: result.entries });
  } catch {
    return privateJson(
      { error: "Collection not found" },
      { status: 404 },
    );
  }
}
