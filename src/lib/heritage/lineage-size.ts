export const CHARACTER_SIZES = [
  "TINY",
  "SMALL",
  "MEDIUM",
  "LARGE",
  "HUGE",
  "GARGANTUAN",
] as const;
export type CharacterSize = (typeof CHARACTER_SIZES)[number];

export function isCharacterSize(value: unknown): value is CharacterSize {
  return (
    typeof value === "string" &&
    (CHARACTER_SIZES as readonly string[]).includes(value)
  );
}

export function parseLineageSize(value: unknown): CharacterSize {
  return isCharacterSize(value) ? value : "MEDIUM";
}

/** A creation default, never a persistent override of a character's size. */
export function creationSize(
  mode: unknown,
  requested: unknown,
  lineageSize: unknown,
): CharacterSize {
  return mode === "quick" || requested == null
    ? parseLineageSize(lineageSize)
    : parseLineageSize(requested);
}
