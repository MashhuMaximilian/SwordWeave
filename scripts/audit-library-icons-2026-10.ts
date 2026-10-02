import iconIndex from "@/lib/icons/game-icons-index.json";
import { db, pool } from "@/db/client";
import { primitives, effects, capabilities, heritage, items, primitiveVersions, effectVersions, capabilityVersions, heritageVersions, itemVersions } from "@/db/schema";
import { capabilityIcons, effectIcons, heritageIcons, suggestPrimitiveIcon } from "./library-icon-curation-2026-10";

const known = new Set(iconIndex.icons.map(icon => icon.key));
const tables = { primitives, effects, capabilities, heritage, items };
const versions = { primitives: primitiveVersions, effects: effectVersions, capabilities: capabilityVersions, heritage: heritageVersions, items: itemVersions };

async function main() {
try {
  for (const [kind, table] of Object.entries(tables)) {
    const rows = await db.select().from(table);
    const publicRows = rows.filter(row => row.isPublic);
    const missing = publicRows.filter(row => !row.iconSource || row.iconSource === "GAME_ICONS" && !row.iconKey);
    const invalid = publicRows.filter(row => row.iconSource === "GAME_ICONS" && row.iconKey && !known.has(row.iconKey));
    const uploads = publicRows.filter(row => row.iconSource === "UPLOAD");
    const proposed = missing.filter(row => row.iconProposedSource === "GAME_ICONS" && row.iconProposedKey && known.has(row.iconProposedKey));
    const phase4 = publicRows.filter(row => row.sourceOrigin?.startsWith("system:v13:heritage-shelf:"));
    const phase4Missing = phase4.filter(row => !row.iconSource || row.iconSource === "GAME_ICONS" && !row.iconKey);
    const versionRows = await db.select().from(versions[kind as keyof typeof versions]);
    const versionIds = new Set(versionRows.map(row => kind === "primitives" ? row.primitiveId : kind === "effects" ? row.effectId : kind === "capabilities" ? row.capabilityId : kind === "heritage" ? row.templateId : row.itemId));
    const unversioned = missing.filter(row => !versionIds.has(row.id));
    console.log(JSON.stringify({ kind, total: rows.length, public: publicRows.length, missing: missing.length, invalid: invalid.length, uploads: uploads.length,
      proposed: proposed.length, phase4: phase4.length, phase4Missing: phase4Missing.length, unversioned: unversioned.length,
      missingExamples: missing.slice(0, 20).map(row => row.name), invalidExamples: invalid.slice(0, 20).map(row => ({ name: row.name, key: row.iconKey })) }));
    if (process.argv.includes("--list")) for (const row of missing) console.log(`${kind}\t${row.name}\t${row.sourceOrigin ?? ""}`);
    if (process.argv.includes("--phase4")) for (const row of phase4) console.log(`${kind}\t${row.name}\t${row.iconKey ?? ""}`);
    if (process.argv.includes("--suggest")) for (const row of missing) {
      const pick = kind === "primitives" ? suggestPrimitiveIcon(row.name, row.category, iconIndex.icons) :
        kind === "effects" ? { key: effectIcons[row.name], source: "curated-effect" } :
          kind === "capabilities" ? { key: capabilityIcons[row.name], source: "curated-capability" } :
            kind === "heritage" ? { key: heritageIcons[row.name], source: "curated-heritage" } :
              { key: "lorc/broadsword", source: "item-name" };
      console.log(`${kind}\t${row.name}\t${pick.key ?? "NO PICK"}\t${pick.source}\t${pick.key && known.has(pick.key) ? "VALID" : "INVALID"}`);
    }
  }
} finally {
  await pool.end();
}
}
main().catch(error => { console.error(error); process.exitCode = 1; });
