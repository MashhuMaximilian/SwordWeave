import { eq, inArray, or, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import registry from "./srd-content-registry-2026-10.json";

const byId = new Map(registry.map(row => [String(row.id), row.seedOrigin]));

/** Stable import identity is separate from the public source label. */
export function seedOrigin(row: { id?: number | string; sourceOrigin?: string | null } | undefined): string | null | undefined {
  if (row?.sourceOrigin === "SRD" && row.id !== undefined) return byId.get(String(row.id)) ?? "SRD";
  return row?.sourceOrigin;
}

export function seedSourceCondition(source: AnyPgColumn, id: AnyPgColumn, origin: string): SQL {
  const ids = registry.filter(row => row.seedOrigin === origin).map(row => row.id);
  return ids.length ? or(eq(source, origin), inArray(id, ids))! : eq(source, origin);
}
