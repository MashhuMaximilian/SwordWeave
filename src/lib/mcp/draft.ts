import { z } from "zod";
import {
  capabilityPrimitiveRoleEnum,
  capabilityTypeEnum,
  characterAttrEnum,
  characterSizeEnum,
  heritageKindEnum,
  itemRarityEnum,
  itemTypeEnum,
  primitiveCategoryEnum,
  sourceTypeEnum,
} from "@/db/schema";
import { MAX_ATTRIBUTE, MIN_ATTRIBUTE } from "@/lib/engine/practices";
import { canonicalJsonStringify } from "@/lib/publishing/hash-content";

const maxPieces = 20;
const maxPlacements = 80;
const maxDraftBytes = 64 * 1024;
const key = z.string().regex(/^[A-Za-z0-9_]{1,32}$/);
const versionId = z.uuid();
const nonPrimitiveKind = z.enum(["effect", "capability", "heritage", "item"]);
export const pinnedRef = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("primitive"),
    id: z.string().regex(/^[1-9][0-9]{0,9}$/).refine(id => Number(id) <= 2147483647),
    versionId,
  }),
  ...nonPrimitiveKind.options.map(kind => z.strictObject({ kind: z.literal(kind), id: z.uuid(), versionId })),
]);

const member = z.strictObject({
  ref: z.union([z.strictObject({ pin: pinnedRef }), z.strictObject({ pieceKey: key })]),
  isMirrored: z.boolean().optional(),
  quantity: z.int().positive().max(2147483647).optional(),
  role: z.enum(capabilityPrimitiveRoleEnum.enumValues).optional(),
});
const members = z.array(member).max(maxPlacements).optional();
const text = z.string().max(4000).refine(value => !value.includes("\0"));
const name = z.string().trim().max(200).refine(value => !value.includes("\0"));
const bu = z.int().nonnegative().max(2147483647);
const commonFields = { name };
const bindingLabel = z.string().trim().min(1).max(120).refine(value => !/\p{Cc}/u.test(value));
const verbTier = z.enum(["Tier I", "Tier II", "Tier III", "Tier IV"]);
const accessDirection = { operation: z.literal("grant").optional(), recipient: z.literal("SELF").optional() };
const compositionRule = z.discriminatedUnion("family", [
  z.strictObject({ family: z.literal("DOMAIN_ACCESS"), ...accessDirection,
    bindings: z.strictObject({ domain: bindingLabel, tier: verbTier.optional() }) }),
  z.strictObject({ family: z.literal("VERB_ACCESS"), ...accessDirection,
    bindings: z.strictObject({ tier: verbTier }) }),
  z.strictObject({ family: z.literal("RANGE"), bindings: z.strictObject({ range: bindingLabel }) }),
  z.strictObject({ family: z.literal("DICE"), bindings: z.strictObject({
    dice: z.string().trim().regex(/^(?:1)?d(?:4|6|8|10|12|20)$/i).transform(value => `1${value.toLowerCase().replace(/^1/, "")}`),
  }) }),
]);
export const authoredPrimitiveFields = z.strictObject({ ...commonFields, narrativeRule: text,
  category: z.enum(primitiveCategoryEnum.enumValues), costTier: z.string().trim().max(40), buCost: bu,
  mechanicalRule: compositionRule.optional(), isMirrorable: z.boolean().optional(), mirrorVector: text.optional(), mirrorBuCredit: bu.optional(),
});
export const authoredCapabilityFields = z.strictObject({
  ...commonFields, verboseDescription: text, type: z.enum(capabilityTypeEnum.enumValues), sourceType: z.enum(sourceTypeEnum.enumValues),
});
export const authoredEffectFields = z.strictObject({ ...commonFields, narrativeDescription: text });
export const authoredHeritageFields = z.strictObject({ ...commonFields, description: text, kind: z.enum(heritageKindEnum.enumValues), defaultSize: z.enum(characterSizeEnum.enumValues).optional() });
export const authoredItemFields = z.strictObject({ ...commonFields, description: text, itemType: z.enum(itemTypeEnum.enumValues), size: z.enum(characterSizeEnum.enumValues), rarity: z.enum(itemRarityEnum.enumValues), buCost: bu.max(1000), slotCost: bu.min(1).max(100) });
const shapes = {
  primitive: authoredPrimitiveFields,
  effect: authoredEffectFields,
  capability: authoredCapabilityFields,
  heritage: authoredHeritageFields,
  item: authoredItemFields,
};

const authoringKind = z.enum(["primitive", ...nonPrimitiveKind.options]);
// The planner separately restricts authoring to independently reproducible pieces.
const piece = z.discriminatedUnion("action", [
  z.strictObject({ key, action: z.literal("reuse"), pin: pinnedRef }),
  z.strictObject({ key, action: z.literal("create"), kind: authoringKind, fields: z.union(Object.values(shapes)), members }),
  z.strictObject({ key, action: z.literal("fork"), from: pinnedRef, changes: z.union(Object.values(shapes).map(shape => shape.partial())).optional(), members }),
]);
export type CreationDraftPiece = z.infer<typeof piece>;

export const placementSource = z.enum(["LINEAGE", "UPBRINGING", "MANIFEST", "PERSONAL", "ITEM"]);
const attributeScore = z.int().min(MIN_ATTRIBUTE).max(MAX_ATTRIBUTE).optional();
const backstory = z.strictObject({
  description: text.optional(),
  personality: text.optional(),
  origin: text.optional(),
  motivation: text.optional(),
  ties: text.optional(),
  flaw: text.optional(),
});

export const draftV1 = z.strictObject({
  schemaVersion: z.literal(1),
  name: name.optional(),
  attributes: z.strictObject({
    physical: attributeScore,
    mental: attributeScore,
    magical: attributeScore,
    proficient: z.enum(characterAttrEnum.enumValues).optional(),
  }).optional(),
  size: z.enum(characterSizeEnum.enumValues).optional(),
  pieces: z.array(piece).max(maxPieces).optional(),
  placements: z.array(z.strictObject({ pieceKey: key, source: placementSource, isMirrored: z.boolean().optional() })).max(maxPlacements).optional(),
  backstory: backstory.optional(),
  portraitPrompt: z.string().max(2000).optional(),
}).refine(draft => Buffer.byteLength(canonicalJsonStringify(draft)) <= maxDraftBytes, "The draft exceeds 64 KiB.")
  .superRefine((draft, context) => {
    for (const [index, entry] of (draft.pieces ?? []).entries()) {
      if (entry.action === "create" && !shapes[entry.kind].safeParse(entry.fields).success) {
        context.addIssue({ code: "custom", path: ["pieces", index, "fields"], message: "Authoring fields do not match this creation kind." });
      }
      if (entry.action === "fork" && entry.changes && !shapes[entry.from.kind].partial().safeParse(entry.changes).success) {
        context.addIssue({ code: "custom", path: ["pieces", index, "changes"], message: "Changed fields do not match this creation kind." });
      }
    }
  });

export const previewCharacterInput = z.strictObject({ draft: draftV1 });
export type DraftV1 = z.infer<typeof draftV1>;
export type PinnedRef = z.infer<typeof pinnedRef>;
