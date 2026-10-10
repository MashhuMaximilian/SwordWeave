import { systemBestiary } from "./catalogue/system-bestiary";
import { systemBestiaryArtwork } from "./catalogue/system-bestiary-art";

/** Curated presentation artwork; authored portraits always take precedence. */
const illustratedCreatures = ["Cinderwing Courier", "Lanternjaw Goblin", "Mossbell Gatekeeper", "Reedglass Marsh Stalker", "The Velvet Regent"];
const systemById = new Map<string, typeof systemBestiaryArtwork[number]>(systemBestiaryArtwork.map(row => [row.id, row]));
const systemByName = new Map<string, typeof systemBestiaryArtwork[number]>(systemBestiaryArtwork.map(row => [row.name, row]));
const recipesByName = new Map(systemBestiary.map(row => [row.name, row]));
export function monsterArtwork(row: {id?: string | undefined; name: string; imageUrl?: string | null | undefined; sourceOrigin?: string | null | undefined; catalogue?: {environment: string; role: string; tactics: string} | undefined}): string | null {
  // An explicit blank is an authored removal, not a request for curated artwork.
  if (typeof row.imageUrl === "string") return row.imageUrl.trim() || null;
  const system = row.id ? systemById.get(row.id) : undefined;
  if (system) return system.path;
  // Historical play copies and creation drafts contain definitions rather than
  // root IDs. Match the saved system recipe, not a user creature's name alone.
  const recipe = recipesByName.get(row.name);
  if (row.sourceOrigin === "SRD" && recipe && row.catalogue &&
      row.catalogue.environment === recipe.environment && row.catalogue.role === recipe.role &&
      row.catalogue.tactics === recipe.tactics) return systemByName.get(row.name)?.path ?? null;
  if (row.sourceOrigin !== "Monster feedback examples · October 2026" || !illustratedCreatures.includes(row.name)) return null;
  return `/art/monsters/${row.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-graphic-v1.webp`;
}
