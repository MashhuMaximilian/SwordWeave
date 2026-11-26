import { z } from "zod";
import { listCharacterCompanions } from "@/lib/character/companions";
import {
  characterCompanionBestiaryPath,
  characterCompanionPlayPath,
  characterCompanionsPath,
} from "@/lib/character/companion-types";
import { characterSheetPdfPath } from "./character-sheet-pdf";
import { characterIdSchema, readOnlyCharacterContext, requireCharacterAccess, type CharacterActor } from "./context-shared";

export const listCharacterCompanionsInput = z.strictObject({ characterId: characterIdSchema });

export function listCharacterCompanionLinks(
  actor: CharacterActor,
  input: z.infer<typeof listCharacterCompanionsInput>,
  resource: string,
) {
  const { characterId } = listCharacterCompanionsInput.parse(input);
  return readOnlyCharacterContext(async () => {
    const { permission } = await requireCharacterAccess(actor, characterId);
    const companions = await listCharacterCompanions(characterId, actor.clerkId);
    return {
      characterId,
      sheetUrl: new URL(characterCompanionsPath(characterId), resource).href,
      downloadUrl: new URL(characterSheetPdfPath(characterId), resource).href,
      companions: companions.map(({ name, playCopyId, bestiary }) => ({
        name,
        ...(permission === "OWNER" && playCopyId ? {
          playSheetUrl: new URL(characterCompanionPlayPath(playCopyId, characterId), resource).href,
        } : {}),
        ...(bestiary ? { bestiary: {
          name: bestiary.name,
          version: bestiary.version,
          url: new URL(characterCompanionBestiaryPath(bestiary.id, bestiary.version), resource).href,
        } } : {}),
      })),
    };
  });
}
