import { z } from "zod";

const text = (max: number) => z.string().trim().min(1).max(max).refine(value => !value.includes("\0"));

export const portraitPromptInput = z.strictObject({
  name: text(200).optional().describe("The name the player has chosen, if any."),
  concept: text(1_000).describe("The character concept and visual context approved for sharing with the image generator."),
  visualDetails: text(2_000).optional().describe("The appearance, clothing, props or setting the player wants shown."),
  artStyle: text(500).optional().describe("The player's preferred style. Omit to use SwordWeave's angular illustration style."),
});

const swordWeaveArtStyle = "Use the attached SwordWeave portraits as visual references. Match their faceted painted and engraved fantasy style, with broad angular planes, hard light and shadow, distressed ink edges, and printed pigment grain. Build depth with midnight navy and petrol teal, then use luminous turquoise, tarnished antique gold, and silver-ivory on the key forms. Design an original subject and scene.";

const swordWeaveArtReferences = [
  { name: "Aster Farwake, character portrait", url: "https://www.swordweave.quest/images/characters/aster-farwake-graphic-v1.webp" },
  { name: "Tidekin, lineage portrait", url: "https://www.swordweave.quest/images/lineages/tidekin-graphic-v1.webp" },
];

export function preparePortraitPrompt({ name, concept, visualDetails, artStyle }: z.output<typeof portraitPromptInput>) {
  const prompt = [
    name ? `Create an original square fantasy character portrait of ${name}.` : "Create an original square fantasy character portrait.",
    concept,
    ...(visualDetails ? [visualDetails] : []),
    artStyle ?? swordWeaveArtStyle,
    "Fill the canvas with a chest-up composition. Keep the face clear in the upper third and leave enough room around it for a circular crop. Exclude text, logos, watermarks, and decorative frames.",
  ].join("\n\n");

  return {
    prompt,
    referenceImages: artStyle ? [] : swordWeaveArtReferences,
    nextStep: `${artStyle ? "" : "Download and attach the two SwordWeave reference images. "}Copy the prompt into a new chat with image generation or use it with your preferred image generator. To add the finished image, open Edit → Edit concept & roots → Portrait on the SwordWeave character sheet. Upload it, add the change to the draft, then review and save.`,
  };
}
