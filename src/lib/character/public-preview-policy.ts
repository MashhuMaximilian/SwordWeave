/** An explicit publication overrides the legacy flag, including unpublishing.
 * Owner/share access is checked separately by the character permission gate. */
export function isPublicCharacterPreview(legacyPublic: boolean, publication: {
  visibility: string;
  unpublishedAt: Date | null;
} | null | undefined): boolean {
  return publication ? publication.visibility === "PUBLIC" && publication.unpublishedAt === null : legacyPublic;
}
