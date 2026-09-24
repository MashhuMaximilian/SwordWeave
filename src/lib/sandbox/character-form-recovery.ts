/** Decode only a compatible complete editor snapshot; recovery never changes live data. */
export function decodeCharacterFormRecovery<T extends Record<string, unknown>>(raw: string | null, shape: T): T | null {
  try {
    const envelope = JSON.parse(raw ?? "null");
    if (envelope?.version !== 1 || !envelope.state || typeof envelope.state !== "object") return null;
    if (!matchesShape(envelope.state, shape)) return null;
    return envelope.state as T;
  } catch { return null; }
}
export function characterFormRecoveryKey(namespace: string, kind: string) {
  return `sw-character-form:v1:${namespace}:${kind}`;
}

function matchesShape(value: unknown, shape: unknown): boolean {
  if (shape === null || shape === undefined) return value !== undefined || shape === undefined;
  if (Array.isArray(shape)) return Array.isArray(value);
  if (typeof shape !== "object") return typeof value === typeof shape;
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.entries(shape).every(([key, expected]) => matchesShape((value as Record<string, unknown>)[key], expected));
}
