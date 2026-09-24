export type CharacterEditorIntent = "overview" | "concept" | "foundation" | "backstory" | "items";
export interface CharacterEditorRequest { characterId: string; intent: CharacterEditorIntent }
export function openCharacterEditor(characterId: string, intent: CharacterEditorIntent = "overview") {
  window.dispatchEvent(new CustomEvent<CharacterEditorRequest>("sw-character-open-editor", { detail: { characterId, intent } }));
}
export function parseCharacterEditorIntent(value: unknown): CharacterEditorIntent {
  return value === "concept" || value === "foundation" || value === "backstory" || value === "items" ? value : "overview";
}
