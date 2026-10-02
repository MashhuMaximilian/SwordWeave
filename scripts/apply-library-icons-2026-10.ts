/** Validate icon selections and save them as versioned library content. Dry run unless --apply. */
import iconIndex from "@/lib/icons/game-icons-index.json";
import { eq } from "drizzle-orm";
import { db, pool, withDatabaseTransaction } from "@/db/client";
import { primitives, effects, capabilities, heritage, items, itemPrimitives, itemCapabilities, itemEffects, primitiveVersions, effectVersions, capabilityVersions, heritageVersions, itemVersions } from "@/db/schema";
import { DEFAULT_ICON_COLOR } from "@/lib/icons/metallic-svg";
import { buildCanonicalPrimitivePayload, buildCanonicalEffectPayload, buildCanonicalCapabilityPayload, buildCanonicalTemplatePayload, buildCanonicalItemPayload, hashPrimitiveContent, hashEffectContent, hashCapabilityContent, hashTemplateContent, hashItemContent } from "@/lib/publishing/hash-content";
import { resolveContentVersionId } from "@/lib/versions/content-hash";
import { capabilityIcons, effectIcons, heritageIcons, permissionIcons, suggestPrimitiveIcon } from "./library-icon-curation-2026-10";

type Kind = "primitive" | "effect" | "capability" | "template" | "item";
type IconRow = { id: number | string; name: string; isPublic: boolean; sourceOrigin: string | null; iconSource: string | null; iconKey: string | null; iconUrl: string | null; iconColor: string; contentHash: string | null; category?: string };
type VersionRow = { id: string; versionNumber: number; isLatest: boolean; snapshot: Record<string, unknown>; primitiveId?: number; effectId?: string; capabilityId?: string; templateId?: string; itemId?: string };
type Plan = { kind: Kind; row: IconRow; latest: VersionRow | null; key: string; color: string; source: string; snapshot: Record<string, unknown>; hash: string };
const known = new Set(iconIndex.icons.map(icon => icon.key));
const apply = process.argv.includes("--apply");

const configs: Array<{ kind: Kind; rows: () => Promise<IconRow[]>; versions: () => Promise<VersionRow[]>; fk: keyof VersionRow }> = [
  { kind: "primitive", rows: async () => await db.select().from(primitives) as IconRow[], versions: async () => await db.select().from(primitiveVersions) as VersionRow[], fk: "primitiveId" },
  { kind: "effect", rows: async () => await db.select().from(effects) as IconRow[], versions: async () => await db.select().from(effectVersions) as VersionRow[], fk: "effectId" },
  { kind: "capability", rows: async () => await db.select().from(capabilities) as IconRow[], versions: async () => await db.select().from(capabilityVersions) as VersionRow[], fk: "capabilityId" },
  { kind: "template", rows: async () => await db.select().from(heritage) as IconRow[], versions: async () => await db.select().from(heritageVersions) as VersionRow[], fk: "templateId" },
  { kind: "item", rows: async () => await db.select().from(items) as IconRow[], versions: async () => await db.select().from(itemVersions) as VersionRow[], fk: "itemId" },
];

function choice(kind: Kind, row: IconRow): { key: string; source: string } | null {
  if (row.iconSource === "UPLOAD") return null;
  if (kind === "primitive") return suggestPrimitiveIcon(row.name, row.category ?? "", iconIndex.icons);
  if (kind === "effect") return effectIcons[row.name] ? { key: effectIcons[row.name], source: "curated-effect" } : null;
  if (kind === "capability") return capabilityIcons[row.name] ? { key: capabilityIcons[row.name], source: "curated-capability" } : null;
  if (kind === "template") {
    const key = heritageIcons[row.name] ?? (row.name === "Ironborn fork test (fork)" ? heritageIcons.Ironborn : null);
    return key ? { key, source: "curated-heritage" } : null;
  }
  if (row.name === "Atelier QA · Bellmetal Gauntlet") return { key: "delapouite/gauntlet", source: "qa-item-fix" };
  if (row.name === "Large Claymore") return { key: "lorc/broadsword", source: "curated-item" };
  return null;
}

function canonical(kind: Kind, snapshot: Record<string, unknown>): Record<string, unknown> {
  if (kind === "primitive") return buildCanonicalPrimitivePayload(snapshot as never) as unknown as Record<string, unknown>;
  if (kind === "effect") return buildCanonicalEffectPayload(snapshot as never) as unknown as Record<string, unknown>;
  if (kind === "capability") return buildCanonicalCapabilityPayload(snapshot as never) as unknown as Record<string, unknown>;
  if (kind === "template") return buildCanonicalTemplatePayload(snapshot as never) as unknown as Record<string, unknown>;
  return buildCanonicalItemPayload(snapshot as never) as unknown as Record<string, unknown>;
}

async function hash(kind: Kind, snapshot: Record<string, unknown>): Promise<string> {
  snapshot = canonical(kind, snapshot);
  if (kind === "primitive") return hashPrimitiveContent(snapshot as never);
  if (kind === "effect") return hashEffectContent(snapshot as never);
  if (kind === "capability") return hashCapabilityContent(snapshot as never);
  if (kind === "template") return hashTemplateContent(snapshot as never);
  return hashItemContent(snapshot as never);
}

async function plan(): Promise<Plan[]> {
  const result: Plan[] = [];
  for (const config of configs) {
    const [rows, versions] = await Promise.all([config.rows(), config.versions()]);
    const latest = new Map<string, VersionRow>();
    for (const version of versions.filter(v => v.isLatest)) latest.set(String(version[config.fk]), version);
    for (const row of rows.filter(r => r.isPublic)) {
      const curated = config.kind === "primitive" ? Boolean(permissionIcons[row.name]) :
        config.kind === "effect" ? Boolean(effectIcons[row.name]) :
          config.kind === "capability" ? Boolean(capabilityIcons[row.name]) :
            config.kind === "template" ? Boolean(heritageIcons[row.name]) : false;
      const validCurrent = row.iconSource === "GAME_ICONS" && row.iconKey && known.has(row.iconKey);
      if (validCurrent && !curated) continue;
      const picked = choice(config.kind, row);
      if (!picked || !known.has(picked.key)) throw new Error(`No valid icon for ${config.kind}: ${row.name} (${picked?.key ?? "none"})`);
      const color = curated || row.iconColor.toLowerCase() === "#ffffff" ? DEFAULT_ICON_COLOR : row.iconColor;
      if (validCurrent && row.iconKey === picked.key && row.iconColor === color) continue;
      const prior = latest.get(String(row.id)) ?? null;
      let original = prior?.snapshot;
      if (!original && config.kind === "item" && row.name === "Atelier QA · Bellmetal Gauntlet") {
        const [full] = await db.select().from(items).where(eq(items.id, String(row.id)));
        const [p, c, e] = await Promise.all([
          db.select().from(itemPrimitives).where(eq(itemPrimitives.itemId, String(row.id))),
          db.select().from(itemCapabilities).where(eq(itemCapabilities.itemId, String(row.id))),
          db.select().from(itemEffects).where(eq(itemEffects.itemId, String(row.id))),
        ]);
        if (!full) throw new Error(`Missing item ${row.name}`);
        original = buildCanonicalItemPayload({ ...full, primitiveIds: p.map(x => x.primitiveId),
          primitiveSlots: p.map(x => ({ primitiveId: x.primitiveId, isMirrored: x.isMirrored })),
          capabilityIds: c.map(x => x.capabilityId), effectIds: e.map(x => x.effectId) }) as unknown as Record<string, unknown>;
      }
      if (!original || original.name !== row.name) throw new Error(`Missing or stale latest snapshot: ${config.kind}:${row.name}`);
      const snapshot = canonical(config.kind, { ...original, iconSource: "GAME_ICONS", iconKey: picked.key, iconUrl: null, iconColor: color });
      result.push({ kind: config.kind, row, latest: prior, key: picked.key, color, source: picked.source, snapshot, hash: await hash(config.kind, snapshot) });
    }
  }
  return result;
}

async function save(item: Plan): Promise<void> {
  const { kind, row, latest, key, color, snapshot, hash: contentHash } = item;
  const fields = { iconSource: "GAME_ICONS" as const, iconKey: key, iconUrl: null, iconColor: color, contentHash, updatedAt: new Date() };
  const versionFields = { versionNumber: (latest?.versionNumber ?? 0) + 1, isLatest: true, deltaKind: "FULL" as const, snapshot };
  const id = resolveContentVersionId(kind, row.id, contentHash);
  if (kind === "primitive") {
    await db.update(primitives).set(fields).where(eq(primitives.id, Number(row.id)));
    await db.update(primitiveVersions).set({ isLatest: false, supersededAt: new Date() }).where(eq(primitiveVersions.primitiveId, Number(row.id)));
    await db.insert(primitiveVersions).values({ ...versionFields, id, primitiveId: Number(row.id) });
  } else if (kind === "effect") {
    await db.update(effects).set(fields).where(eq(effects.id, String(row.id)));
    await db.update(effectVersions).set({ isLatest: false, supersededAt: new Date() }).where(eq(effectVersions.effectId, String(row.id)));
    await db.insert(effectVersions).values({ ...versionFields, id, effectId: String(row.id) });
  } else if (kind === "capability") {
    await db.update(capabilities).set(fields).where(eq(capabilities.id, String(row.id)));
    await db.update(capabilityVersions).set({ isLatest: false, supersededAt: new Date() }).where(eq(capabilityVersions.capabilityId, String(row.id)));
    await db.insert(capabilityVersions).values({ ...versionFields, id, capabilityId: String(row.id) });
  } else if (kind === "template") {
    await db.update(heritage).set(fields).where(eq(heritage.id, String(row.id)));
    await db.update(heritageVersions).set({ isLatest: false, supersededAt: new Date() }).where(eq(heritageVersions.templateId, String(row.id)));
    await db.insert(heritageVersions).values({ ...versionFields, id, templateId: String(row.id) });
  } else {
    await db.update(items).set(fields).where(eq(items.id, String(row.id)));
    await db.update(itemVersions).set({ isLatest: false, supersededAt: new Date() }).where(eq(itemVersions.itemId, String(row.id)));
    await db.insert(itemVersions).values({ ...versionFields, id, itemId: String(row.id) });
  }
}

async function main(): Promise<void> {
  try {
    const planned = await plan();
    const counts = Object.fromEntries(configs.map(config => [config.kind, planned.filter(item => item.kind === config.kind).length]));
    console.log(`Icon plan: ${JSON.stringify(counts)} (${planned.length} versioned changes).`);
    if (process.argv.includes("--list")) for (const item of planned) console.log(`${item.kind}\t${item.row.name}\t${item.row.iconKey ?? ""}\t${item.key}\t${item.source}`);
    if (!apply) { console.log("DRY RUN ONLY"); return; }
    for (const config of configs) {
      const batch = planned.filter(item => item.kind === config.kind);
      if (!batch.length) continue;
      await withDatabaseTransaction(async () => { for (const item of batch) await save(item); });
      console.log(`Saved ${batch.length} ${config.kind} icons.`);
    }
  } finally { await pool.end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
