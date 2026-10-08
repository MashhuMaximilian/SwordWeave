import { distributeAttributeSlices, validatePracticeSlicesForAttribute,PRACTICE_ATTRIBUTE_MAP, type Attributes } from "@/lib/engine/practices";
import { z } from "zod";
const safeInt = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
export const referenceSchema = z.object({ kind: z.enum(["PRIMITIVE", "CAPABILITY", "EFFECT", "HERITAGE", "ITEM"]), id: z.string().min(1), quantity: safeInt.min(1).default(1), isMirrored: z.boolean().default(false), versionId: z.string().nullable().default(null) });
export const monsterDefinitionSchema = z.object({
  catalogue: z.object({environment:z.string().max(100),role:z.string().max(100),tactics:z.string().max(3000),tags:z.array(z.string().max(60)).max(20)}).optional(),
  name: z.string().trim().min(1).max(200), sourceOrigin: z.string().trim().max(2000).optional(), concept: z.string().max(20000).default(""), budget: safeInt.min(1),
  // Optional fields keep historical snapshots byte-compatible. Artwork is a
  // reference, never image data embedded in a template or play copy.
  imageUrl: z.string().trim().max(2048).refine(value => value === "" || /^https?:\/\/[^\s]+$/i.test(value) || /^\/(?!\/)[^\s]*$/.test(value), "Use an image URL or an uploaded portrait.").nullable().optional(),
  portraitFrame: z.object({ x: z.number().min(0).max(100), y: z.number().min(0).max(100), zoom: z.number().min(.5).max(3) }).optional(),
  size: z.enum(["TINY", "SMALL", "MEDIUM", "LARGE", "HUGE", "GARGANTUAN"]).default("MEDIUM"),
  attributes: z.object({ physical: safeInt, mental: safeInt, magical: safeInt }),
  proficientAttribute: z.enum(["physical", "mental", "magical"]).default("physical"),
  practiceSlices:z.record(z.string(),safeInt).default({}),
  baselineVitality: safeInt.min(1).nullable().default(null), references: z.array(referenceSchema).max(500).default([]),
}).transform(d=>({...d,practiceSlices:Object.keys(d.practiceSlices).length?d.practiceSlices:autoMonsterPractices(d.attributes)})).superRefine((d, ctx) => {for(const key of Object.keys(d.practiceSlices))if(!Object.values(PRACTICE_ATTRIBUTE_MAP).flat().includes(key as never))ctx.addIssue({code:"custom",path:["practiceSlices",key],message:"Unknown practice."});for(const attribute of ["PHYSICAL","MENTAL","MAGICAL"] as const){const validation=validatePracticeSlicesForAttribute(attribute,d.attributes[attribute.toLowerCase() as keyof Attributes],d.practiceSlices);if(!validation.valid)ctx.addIssue({code:"custom",path:["practiceSlices"],message:validation.errors.join(" ")});} if (d.attributes.physical + d.attributes.mental + d.attributes.magical !== (Number.isSafeInteger(d.budget)&&d.budget>0?monsterBaselines(d.budget).attributePoints:0)) ctx.addIssue({ code: "custom", path: ["attributes"], message: "Allocate exactly the available attribute points." }); });
export type MonsterDefinition = z.infer<typeof monsterDefinitionSchema>;
export type MonsterReference = z.infer<typeof referenceSchema>;
export function monsterBaselines(budget: number) {
  if (!Number.isSafeInteger(budget) || budget < 1) throw new Error("Budget must be a positive safe integer.");
  const rank = Math.sqrt(budget / 25);
  return { rank, attributePoints: Math.ceil(3 * rank), pb: 1 + Math.ceil(rank), vitality: Math.max(1, Math.ceil(budget * .5)) };
}
/** Increasing the maximum never restores spent Vitality. */
export function clampMonsterVitality(current: number, maximum: number) { return Math.max(0, Math.min(current, maximum)); }
export function shuffleMonsterAttributes(budget: number, attributes: MonsterDefinition["attributes"], locks: readonly string[], random = Math.random) {
  const next = { ...attributes }; const keys = (["physical", "mental", "magical"] as const).filter(k => !locks.includes(k));
  const remaining = monsterBaselines(budget).attributePoints - locks.reduce((n, k) => n + (attributes[k as keyof typeof attributes] ?? 0), 0);
  if (remaining < 0 || !keys.length) return next;
  keys.forEach(k => { next[k] = 0; });
  // Draw cuts in constant time even for very large budgets.
  let left = remaining; keys.forEach((k, i) => { next[k] = i === keys.length - 1 ? left : Math.floor(random() * (left + 1)); left -= next[k]; });
  return next;
}
/** Keep each play copy independent from future edits to the template. */
export function pinMonsterSnapshot<T>(snapshot:T):T { return structuredClone(snapshot); }

export function autoMonsterPractices(attributes:Attributes){return {...distributeAttributeSlices("PHYSICAL",attributes.physical),...distributeAttributeSlices("MENTAL",attributes.mental),...distributeAttributeSlices("MAGICAL",attributes.magical)};}
export function sameMonsterSnapshot(a:unknown,b:unknown):boolean {const normalize=(v:unknown):unknown=>Array.isArray(v)?v.map(normalize):v&&typeof v==="object"?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b)).map(([k,x])=>[k,normalize(x)])):v;return JSON.stringify(normalize(a))===JSON.stringify(normalize(b));}
export function shuffleMonsterAllocation(definition:MonsterDefinition,locks:readonly string[],random=Math.random){const attributes=shuffleMonsterAttributes(definition.budget,definition.attributes,locks,random),practiceSlices=autoMonsterPractices(attributes);for(const attribute of ["PHYSICAL","MENTAL","MAGICAL"] as const)if(locks.includes(attribute.toLowerCase()))for(const practice of PRACTICE_ATTRIBUTE_MAP[attribute])practiceSlices[practice]=definition.practiceSlices[practice]??practiceSlices[practice];return {attributes,practiceSlices};}
