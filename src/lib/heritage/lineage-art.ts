/** Presentation only: never substitute art on unrelated user-authored lineages. */
const mainNames = ["Human", "Mountainfolk", "Skyborn", "Tidekin", "Ironborn", "Forestkind", "Ashlung", "Burrowhide", "Toneweft", "Sporeveil", "Claymold", "Mirrorhide", "Flintskin", "Rootwaker", "Latticevein", "Coppervein", "Nightpupil", "Lantern-eyed", "Hollowbone", "Antlerhand", "Chitterkin", "Longreach", "Mirebody", "Kilnmaw"];
const baseNames = ["Hearthspark", "Duskling", "Griproot", "Whispercolony", "Glidesprout", "Reachling"];
export const curatedLineageArt = [
  ...mainNames.map(name => ({ name, prefix: "system:v13:heritage-shelf:" })),
  ...baseNames.map(name => ({ name, prefix: "system:v14:early-heritage-base:" })),
].map(({name, prefix}) => {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return { name, sourceOrigin: ["Human", "Mountainfolk", "Skyborn", "Tidekin", "Ironborn", "Forestkind"].includes(name) ? "system" : `${prefix}lineage:${slug}`, imageUrl: `/images/lineages/${slug}-graphic-v1.webp` };
});

export function lineageArtUrl(row: { kind?: string; name?: string; sourceOrigin?: string | null; imageUrl?: string | null }): string | null {
  const explicit = row.imageUrl?.trim();
  if (explicit) return explicit;
  if (row.kind !== "LINEAGE") return null;
  return curatedLineageArt.find(art => art.name === row.name && art.sourceOrigin === row.sourceOrigin)?.imageUrl ?? null;
}
