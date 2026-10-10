import { auth } from "@clerk/nextjs/server";
import { readCharacterCataloguePreview } from "@/lib/character/catalogue-preview";
import { privateJson } from "@/lib/http/private-json";
export async function GET(
  _: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id))
    return privateJson({ error: "Character unavailable." }, { status: 404 });
  const { userId } = await auth();
  const character = await readCharacterCataloguePreview(id, userId);
  return character
    ? privateJson({ character })
    : privateJson({ error: "Character unavailable." }, { status: 404 });
}
