/** JSON objects have no field order; arrays (including modifier order) do. */
export function consequenceJson(value: unknown): string {
  return JSON.stringify(value ?? null, (_key, item: unknown) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return item;
    const record = item as Record<string, unknown>;
    return Object.fromEntries(Object.keys(record).sort().map(key => [key, record[key]]));
  });
}
