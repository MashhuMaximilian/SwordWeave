export type CharacterPermission = "OWNER" | "EDITOR" | "SUGGESTER" | "VIEWER";
const ranks: Record<CharacterPermission, number> = { OWNER: 3, EDITOR: 2, SUGGESTER: 1, VIEWER: 0 };
export function meetsCharacterPermission(actual: CharacterPermission, required: CharacterPermission): boolean {
  return ranks[actual] >= ranks[required];
}
export function permissionFromShare(canEdit: boolean, canSuggest: boolean): CharacterPermission {
  return canEdit ? "EDITOR" : canSuggest ? "SUGGESTER" : "VIEWER";
}
