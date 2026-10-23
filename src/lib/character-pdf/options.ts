import { z } from "zod";

export const CHARACTER_PDF_STYLES = [
  { id: "aegis", name: "Aegis" }, { id: "vesper", name: "Vesper" },
  { id: "orrery", name: "Orrery" }, { id: "moire", name: "Moiré" },
  { id: "serein", name: "Serein" }, { id: "prism", name: "Prism" },
  { id: "cipher", name: "Cipher" }, { id: "helix", name: "Helix" },
  { id: "cinder", name: "Cinder" }, { id: "nocturne", name: "Nocturne" },
  { id: "tidal", name: "Tidal" }, { id: "solstice", name: "Solstice" },
] as const;
export type CharacterPdfStyle = typeof CHARACTER_PDF_STYLES[number]["id"];

export const characterPdfOptionsSchema = z.object({
  style: z.enum(CHARACTER_PDF_STYLES.map(style => style.id) as [CharacterPdfStyle, ...CharacterPdfStyle[]]).default("aegis"),
  density: z.enum(["auto", "normal", "compact"]).default("auto"),
  orientation: z.enum(["portrait", "landscape"]).default("portrait"),
  workbench: z.boolean().default(false),
  color: z.boolean().default(false),
}).strict();
export type CharacterPdfOptions = z.infer<typeof characterPdfOptionsSchema>;
export const DEFAULT_CHARACTER_PDF_OPTIONS: CharacterPdfOptions = characterPdfOptionsSchema.parse({});

/** ASCII attachment names also work on browsers with older PDF viewers. */
export function characterPdfFilename(name: string, options: CharacterPdfOptions): string {
  const safeName = name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "character";
  return `swordweave-${safeName.toLowerCase()}-${options.style}-${options.orientation}${options.color ? "-color" : ""}.pdf`;
}
