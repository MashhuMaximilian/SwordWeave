/** An explicit publication overrides the legacy flag, including unpublishing.
 * Owner/share access is checked separately by the character permission gate. */
export function isPublicCharacterPreview(legacyPublic: boolean, publication: {
  visibility: string;
  unpublishedAt: Date | null;
} | null | undefined): boolean {
  return publication ? publication.visibility === "PUBLIC" && publication.unpublishedAt === null : legacyPublic;
}

/** A public viewing URL can restrict a grant, but can never create a grant. */
export function characterSheetPermission(
  granted: import("./can-resolve-character").CharacterPermission | null,
  isPublic: boolean,
  publicViewRequested: boolean,
): import("./can-resolve-character").CharacterPermission | null {
  if (!granted && !isPublic) return null;
  return publicViewRequested || !granted ? "VIEWER" : granted;
}
