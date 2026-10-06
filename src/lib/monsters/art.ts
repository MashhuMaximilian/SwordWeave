/** Curated presentation artwork; authored portraits always take precedence. */
const illustratedCreatures = ["Cinderwing Courier", "Lanternjaw Goblin", "Mossbell Gatekeeper", "Reedglass Marsh Stalker", "The Velvet Regent"];
export function monsterArtwork(row: {name: string; imageUrl?: string | null | undefined; sourceOrigin?: string | null | undefined}): string | null {
  if (row.imageUrl?.trim()) return row.imageUrl.trim();
  if (row.sourceOrigin !== "Monster feedback examples · October 2026" || !illustratedCreatures.includes(row.name)) return null;
  return `/art/monsters/${row.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-graphic-v1.webp`;
}
