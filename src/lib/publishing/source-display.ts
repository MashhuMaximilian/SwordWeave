/** Public book/source credit. Import keys and legacy admin IDs are not titles. */
export function sourceDisplayLabel(source: string | null | undefined, isAdmin = false): string | null {
  if (isAdmin || source === "SRD" || source === "system" || source?.startsWith("system:")) return "SRD";
  return source?.trim() || null;
}
