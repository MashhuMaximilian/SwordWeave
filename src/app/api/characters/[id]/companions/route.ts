import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { CharacterAccessDenied } from "@/lib/character/can-resolve-character";
import { listCharacterCompanionCandidates, listCharacterCompanions } from "@/lib/character/companions";
import { privateJson } from "@/lib/http/private-json";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const query = new URL(request.url).searchParams;
  if (query.get("view") === "public") return privateJson({ companions: [] });
  const { userId } = await auth();
  if (!userId) return privateJson({ error: "Sign in to view companions." }, { status: 401 });
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) return privateJson({ error: "Character not found." }, { status: 404 });
  try {
    if (query.get("picker") === "1") {
      const search = z.string().trim().max(120).safeParse(query.get("q") ?? "");
      if (!search.success) return privateJson({ error: "Search for a shorter monster name." }, { status: 400 });
      const candidates = await listCharacterCompanionCandidates(id.data, userId, search.data);
      return privateJson({ candidates });
    }
    return privateJson({ companions: await listCharacterCompanions(id.data, userId) });
  } catch (error) {
    if (error instanceof CharacterAccessDenied)
      return privateJson({ error: "Character not found." }, { status: 404 });
    return privateJson({ error: "Companions could not be loaded." }, { status: 500 });
  }
}
