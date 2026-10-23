type Row = Record<string, unknown>;
type Catalog = { primitives: unknown[]; effects: unknown[]; capabilities: unknown[]; heritage: unknown[]; items: unknown[] };
export function isGuestAtelierPath(pathname: string): boolean { return /^\/atelier\/?$/.test(pathname); }

/** Related rows do not inherit their parent's visibility. Filter every depth before serialization. */
export function restrictAtelierRelations(catalog: Catalog): Catalog {
  const visible = {
    primitive: new Set(catalog.primitives.map(row => String((row as Row)["id"]))),
    effect: new Set(catalog.effects.map(row => String((row as Row)["id"]))),
    capability: new Set(catalog.capabilities.map(row => String((row as Row)["id"]))),
  };
  function clean(value: unknown, depth = 0): unknown {
    if (depth > 12) return null;
    if (Array.isArray(value)) return value.filter(entry => {
      if (!entry || typeof entry !== "object") return true;
      const link = entry as Row;
      for (const kind of ["primitive", "effect", "capability"] as const) {
        const id = link[`${kind}Id`] ?? (link[kind] as Row | undefined)?.["id"];
        if (id !== undefined && !visible[kind].has(String(id))) return false;
      }
      return true;
    }).map(entry => clean(entry, depth + 1));
    if (!value || typeof value !== "object") return value;
    // Rules, dates and authored JSON are not graph edges. Preserve them exactly.
    const relationKeys = new Set(["primitiveLinks", "effectLinks", "capabilityLinks", "primitive", "effect", "capability"]);
    return Object.fromEntries(Object.entries(value as Row).map(([key, entry]) => [key, relationKeys.has(key) ? clean(entry, depth + 1) : entry]));
  }
  return Object.fromEntries(Object.entries(catalog).map(([kind, rows]) => [kind, clean(rows)])) as Catalog;
}

/** Historical payloads can contain formerly private text/relations. Guests get current public rows only. */
export function canLoadAtelierHistory(viewerId: string | null, rowVisible: boolean): boolean {
  return Boolean(viewerId && rowVisible);
}
