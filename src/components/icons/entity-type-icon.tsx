import type { CSSProperties } from "react";

export const ENTITY_TYPE_ICONS: Record<string, string> = {
  ALL: "delapouite/bookshelf", GROUP_MECHANICS: "lorc/cubeforce", mechanics: "lorc/cubeforce",
  PRIMITIVE: "delapouite/cube", primitive: "delapouite/cube",
  EFFECT: "lorc/cubes", effect: "lorc/cubes",
  CAPABILITY: "lorc/cubeforce", capability: "lorc/cubeforce",
  GROUP_HERITAGES: "lorc/dna2", heritage: "lorc/dna2",
  LINEAGE: "lorc/dna2", LINEAGE_TEMPLATE: "lorc/dna2",
  UPBRINGING: "delapouite/plant-roots", UPBRINGING_TEMPLATE: "delapouite/plant-roots",
  MANIFEST: "caro-asercion/tarot-11-justice", MANIFEST_TEMPLATE: "caro-asercion/tarot-11-justice",
  ITEM: "lorc/battle-gear", item: "lorc/battle-gear",
  MONSTER: "lorc/gluttonous-smile", monster: "lorc/gluttonous-smile",
  CREATE_CHARACTER: "lorc/cultist", CREATE_MONSTER: "delapouite/spiked-dragon-head",
};

/** A silhouette mask lets the shared metallic finish follow interaction state. */
export function EntityTypeIcon({ type, iconKey, size = 20 }: { type?: string; iconKey?: string; size?: number }) {
  const key = iconKey ?? ENTITY_TYPE_ICONS[type ?? "ALL"] ?? ENTITY_TYPE_ICONS["ALL"];
  const mask = `url("/icons/entity-types/${key}.svg")`;
  return <span aria-hidden="true" className="sw-entity-type-icon" style={{width:size,height:size,maskImage:mask,WebkitMaskImage:mask} as CSSProperties}/>;
}
