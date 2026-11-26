import { z } from "zod";
import { characterPdfOptionsSchema, DEFAULT_CHARACTER_PDF_OPTIONS, type CharacterPdfOptions } from "@/lib/character-pdf/options";
import type { McpActor } from "./auth";
import { characterIdSchema, requireCharacterAccess } from "./context-shared";

export const characterSheetPdfInput = z.strictObject({ characterId: characterIdSchema, options: characterPdfOptionsSchema.optional() });

export function characterSheetPdfPath(characterId: string, options = DEFAULT_CHARACTER_PDF_OPTIONS) {
  const path = `/api/companion/characters/${encodeURIComponent(characterId)}/sheet-pdf`;
  const settings = new URLSearchParams();
  for (const key of Object.keys(DEFAULT_CHARACTER_PDF_OPTIONS) as Array<keyof CharacterPdfOptions>) {
    if (options[key] !== DEFAULT_CHARACTER_PDF_OPTIONS[key]) settings.set(key, String(options[key]));
  }
  return settings.size ? `${path}?${settings}` : path;
}

export function readCharacterSheetPdfOptions(settings: URLSearchParams) {
  const options: Record<string, unknown> = Object.create(null);
  let hasChatGptSource = false;
  for (const [key, value] of settings) {
    // ChatGPT can append this when it renders a tool link in a response.
    if (key === "utm_source" && value === "chatgpt.com" && !hasChatGptSource) {
      hasChatGptSource = true;
      continue;
    }
    if (!Object.hasOwn(DEFAULT_CHARACTER_PDF_OPTIONS, key) || Object.hasOwn(options, key)) return null;
    options[key] = (key === "workbench" || key === "color") && (value === "true" || value === "false")
      ? value === "true" : value;
  }
  return characterPdfOptionsSchema.safeParse(options).data ?? null;
}

export async function getCharacterSheetPdfLink(actor: McpActor, input: z.infer<typeof characterSheetPdfInput>, resource: string) {
  const { characterId, options } = characterSheetPdfInput.parse(input);
  const { character } = await requireCharacterAccess(actor, characterId);
  return {
    characterId: character.id,
    downloadUrl: new URL(characterSheetPdfPath(character.id, options), resource).href,
  };
}
