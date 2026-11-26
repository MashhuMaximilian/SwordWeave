import { auth } from "@clerk/nextjs/server";
import { privateJson } from "@/lib/http/private-json";
import { cumulativeBuForLevel, getVolatilityCeiling } from "@/lib/engine/bu";
import { bustResolverCache } from "@/lib/cache/character-resolver-cache";
import { maxStoredCharacterLevel, writeCharacterAdvancement } from "@/lib/character/advancement";
import { CharacterAccessDenied } from "@/lib/character/can-resolve-character";
import { withCharacterMutation } from "@/lib/character/mutation-transaction";
import { resolveCharacterAccess } from "@/lib/character/resolve-character-access";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth.protect();
    const { id } = await params;
    if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id)) {
      return privateJson({ error: "Character unavailable." }, { status: 404 });
    }
    const body: unknown = await request.json().catch(() => ({}));
    const raw = body && typeof body === "object" && "newVitality" in body ? body.newVitality : null;
    const vitality = raw == null ? undefined : Number(raw);
    if (vitality !== undefined && (!Number.isInteger(vitality) || vitality < 0 || vitality > 2_147_483_647)) {
      return privateJson({ error: "newVitality must be a non-negative integer." }, { status: 400 });
    }

    const response = await withCharacterMutation(id, async () => {
      const { character: current } = await resolveCharacterAccess(userId, id, { require: "OWNER" });
      if (current.level >= maxStoredCharacterLevel) {
        return privateJson({ error: "This character has reached the maximum stored level." }, { status: 409 });
      }
      const { character } = await writeCharacterAdvancement(current, current.level + 1, userId, vitality);
      const ceiling = getVolatilityCeiling(character.level);
      return privateJson({
        character, message: `Leveled up to ${character.level}. DM bonus BU consumed into progression pool.`,
        progressionGained: cumulativeBuForLevel(character.level) - cumulativeBuForLevel(current.level),
        volatilityCeiling: ceiling.maxNegativeBu, volatilityBracket: ceiling.levelBracket,
      });
    });
    if (response.ok) bustResolverCache(id);
    return response;
  } catch (error) {
    if (error instanceof CharacterAccessDenied) return privateJson({ error: "Character unavailable." }, { status: 404 });
    return privateJson({ error: "Could not level up this character." }, { status: 400 });
  }
}
