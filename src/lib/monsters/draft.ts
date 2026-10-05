/** Draft-only identity for calculation; publishing still requires the real name. */
export function monsterPreviewInput(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const draft = value as Record<string, unknown>;
  return typeof draft["name"] === "string" && !draft["name"].trim()
    ? { ...draft, name: "Your creature" }
    : value;
}
