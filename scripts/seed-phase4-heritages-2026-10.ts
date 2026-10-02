/** Curated 24/48/18 heritage shelf. Dry-run by default; --apply writes versioned content. */
import { readFileSync } from "node:fs";
import { and, eq } from "drizzle-orm";
import { db, pool, withDatabaseTransaction } from "@/db/client";
import {
  capabilities, capabilityEffects, capabilityPrimitives, capabilityVersions,
  effectPrimitives, effects, effectVersions, forks, heritage, heritageCapabilities,
  heritagePrimitives, heritageVersions, primitiveMarketClassifications,
  primitives, primitiveVersions, publications, users,
} from "@/db/schema";
import {
  buildCanonicalCapabilityPayload, buildCanonicalEffectPayload,
  buildCanonicalPrimitivePayload, buildCanonicalTemplatePayload,
  hashCapabilityContent, hashEffectContent, hashPrimitiveContent, hashTemplateContent,
} from "@/lib/publishing/hash-content";
import { resolveContentVersionId } from "@/lib/versions/content-hash";
import { resolveVirtualVersionId } from "@/lib/engagement/version-helpers";
import { capabilityIdeas, effectIdeas, heritageRecipes, permissions } from "./phase4-heritage-data";

type Primitive = typeof primitives.$inferSelect;
type Capability = typeof capabilities.$inferSelect;
type Effect = typeof effects.$inferSelect;
type Heritage = typeof heritage.$inferSelect;
const prefix = "system:v13:heritage-shelf:";
const slug = (name: string) => name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const kindTarget = (kind: string) => `${kind}_TEMPLATE` as "LINEAGE_TEMPLATE" | "UPBRINGING_TEMPLATE" | "MANIFEST_TEMPLATE";
const apply = process.argv.includes("--apply");

function concepts(): Map<string, { text: string; targetBu: number }> {
  const md = readFileSync("docs/library/phase4-heritage-top-down-2026-10.md", "utf8");
  const out = new Map<string, { text: string; targetBu: number }>();
  for (const line of md.split("\n")) {
    if (!/^\|\s*\d+\s*\|/.test(line)) continue;
    const cells = line.split("|").slice(1, -1).map(x => x.trim());
    if (cells.length < 4) continue;
    const name = cells[1]!.replace(/\*\*/g, "").replace(/\s*·\s*repair$/, "").trim();
    const targetBu = Number(cells.at(-1));
    if (!Number.isFinite(targetBu)) continue;
    const text = cells[2]!.replace(/\*\*/g, "").replace(/<br\s*\/?\s*>/g, " ").trim();
    out.set(name, { text, targetBu });
  }
  return out;
}

// The existing family parents keep the fork map meaningful. Occupational
// permissions use a new private template; its children are purchasable.
function parentFor(name: string): { id: number | "practical"; family: string } {
  if (name === "Kiln-Cured Teeth") return { id: 21351, family: "HERITAGE_AUGMENT" };
  if (["Slow Facial Reshaping", "Still-Surface Camouflage", "Spark-Shedding Skin", "Sensitive Branch Feelers", "Soft-Body Compression"].includes(name))
    return { id: 183, family: "METAMORPHOSIS" };
  if (["Extended Hand Reach", "Canopy Footing", "Anchored Safety Line"].includes(name))
    return { id: 218, family: "MOBILITY" };
  if (["Water Pressure Sense", "Soil Disturbance Sense", "Electrical Contact Sense", "Dim-Light Acuity", "Controlled Eye Light"].includes(name))
    return { id: 214, family: "SENSORY_ARRAY" };
  return { id: "practical", family: "HERITAGE_AUGMENT" };
}

function tier(cost: number) { return cost <= 2 ? 1 : cost <= 4 ? 2 : cost <= 8 ? 3 : 4; }
function unique<T>(values: T[]): T[] { return [...new Set(values)]; }
function describe(name: string, concept: string, price: number, primitivesUsed: string[], capabilitiesUsed: string[]): string {
  const playerConcept = concept.split(";")[0]!.trim();
  const qualifier = name === "Mystic" ? " This sample is a Light-domain Mystic; other domains can be built from the same market families."
    : name === "Elemental Shaper" ? " This sample specializes in Stone; another domain requires its own purchased primitives."
      : name === "Hexwright" ? " The spoken consequence is decided from the particular scene, without a universal condition penalty."
        : "";
  const techniques=capabilitiesUsed.length?` Techniques: ${capabilitiesUsed.join(", ")}.`:"";
  return `${playerConcept}${playerConcept.endsWith(".") ? "" : "."}${qualifier} Linked primitives: ${primitivesUsed.join(", ")}.${techniques} This example contains ${price} BU of distinct linked primitives; the container has no additional BU cost.`;
}
function role(p: Primitive): "VERB" | "DOMAIN" | "SIZING" | "RANGE" | "DURATION" | "OUTPUT" | "OTHER" {
  if (p.category === "DOMAIN") return "DOMAIN";
  if (p.category === "VERB_TIER") return "VERB";
  if (p.category === "SIZING") return "SIZING";
  if (p.category === "RANGE") return "RANGE";
  if (p.category === "DURATION") return "DURATION";
  if (p.category === "INTENSITY_DICE") return "OUTPUT";
  if (p.category === "STRUCTURAL") return "SIZING";
  return "OTHER";
}

async function publish(targetType: "PRIMITIVE" | "EFFECT" | "CAPABILITY" | "LINEAGE_TEMPLATE" | "UPBRINGING_TEMPLATE" | "MANIFEST_TEMPLATE", targetId: string, versionId: string, versionNumber: number): Promise<void> {
  const [row] = await db.select().from(publications).where(and(eq(publications.targetType, targetType), eq(publications.targetId, targetId))).limit(1);
  if (row) {
    if (row.visibility !== "PUBLIC" || row.unpublishedAt) throw new Error(`Publication deliberately hidden: ${targetType}:${targetId}`);
    return;
  }
  // The app's create endpoint also uses a virtual publication id; version
  // snapshots remain content-addressed and are written separately.
  await db.insert(publications).values({ targetType, targetId, versionId: resolveVirtualVersionId(targetType, targetId), versionNumber: 1, authorId: null, visibility: "PUBLIC" });
  void versionId; void versionNumber;
}

async function saveVersion(kind: "primitive" | "effect" | "capability" | "template", id: number | string, hash: string, snapshot: Record<string, unknown>): Promise<{ id: string; number: number }> {
  const table = kind === "primitive" ? primitiveVersions : kind === "effect" ? effectVersions : kind === "capability" ? capabilityVersions : heritageVersions;
  const fk = kind === "primitive" ? primitiveVersions.primitiveId : kind === "effect" ? effectVersions.effectId : kind === "capability" ? capabilityVersions.capabilityId : heritageVersions.templateId;
  const prior = await db.select().from(table).where(eq(fk as never, id as never)).orderBy(kind === "primitive" ? primitiveVersions.versionNumber : kind === "effect" ? effectVersions.versionNumber : kind === "capability" ? capabilityVersions.versionNumber : heritageVersions.versionNumber);
  const versionId = resolveContentVersionId(kind, id, hash);
  const found = prior.find(x => x.id === versionId);
  if (found) return { id: found.id, number: found.versionNumber };
  const number = (prior.at(-1)?.versionNumber ?? 0) + 1;
  if (kind === "primitive") {
    await db.update(primitiveVersions).set({ isLatest: false }).where(eq(primitiveVersions.primitiveId, Number(id)));
    await db.insert(primitiveVersions).values({ id: versionId, primitiveId: Number(id), versionNumber: number, isLatest: true, deltaKind: "FULL", snapshot });
  } else if (kind === "effect") {
    await db.update(effectVersions).set({ isLatest: false }).where(eq(effectVersions.effectId, String(id)));
    await db.insert(effectVersions).values({ id: versionId, effectId: String(id), versionNumber: number, isLatest: true, deltaKind: "FULL", snapshot });
  } else if (kind === "capability") {
    await db.update(capabilityVersions).set({ isLatest: false }).where(eq(capabilityVersions.capabilityId, String(id)));
    await db.insert(capabilityVersions).values({ id: versionId, capabilityId: String(id), versionNumber: number, isLatest: true, deltaKind: "FULL", snapshot });
  } else {
    await db.update(heritageVersions).set({ isLatest: false }).where(eq(heritageVersions.templateId, String(id)));
    await db.insert(heritageVersions).values({ id: versionId, templateId: String(id), versionNumber: number, isLatest: true, deltaKind: "FULL", snapshot });
  }
  return { id: versionId, number };
}

async function main(): Promise<void> {
  const conceptMap = concepts();
  if (heritageRecipes.length !== 90 || conceptMap.size < 90) throw new Error(`Recipe/document count mismatch ${heritageRecipes.length}/${conceptMap.size}`);
  for (const r of heritageRecipes) if (!conceptMap.has(r.name)) throw new Error(`Missing concept: ${r.name}`);
  const originalPrimitives = await db.select().from(primitives);
  const originalEffects = await db.select().from(effects);
  const originalCaps = await db.select().from(capabilities);
  const originalHeritages = await db.select().from(heritage);
  const [actor] = await db.select({ id: users.id }).from(users).where(eq(users.isAdmin, true)).limit(1);
  if (!actor) throw new Error("No admin actor for fork attribution");
  const p = new Map<string, Primitive>();
  const pById = new Map(originalPrimitives.map(x => [x.id, x]));
  for (const row of originalPrimitives.filter(x => x.isPublic)) {
    if (!p.has(row.name) || row.sourceOrigin?.startsWith("system") && !p.get(row.name)!.sourceOrigin?.startsWith("system")) p.set(row.name, row);
  }
  // Names with a legacy duplicate require an explicit, audited canonical id.
  for (const [name, id] of [["Broad Familiarity",22393],["Focused Presence (Global DC Modifier)",22391],["Verb Access Tier I",20]] as const) {
    const row = pById.get(id); if (!row || row.name !== name) throw new Error(`Canonical id drift ${name}`); p.set(name,row);
  }
  const planned = new Set(permissions.map(x => x.name));
  const needP = unique([...effectIdeas.flatMap(x => x.primitives), ...capabilityIdeas.flatMap(x => x.primitives), ...heritageRecipes.flatMap(x => x.primitives)]);
  const missing = needP.filter(name => !p.has(name) && !planned.has(name));
  if (missing.length) throw new Error(`Missing primitives: ${missing.join(", ")}`);
  const plannedEffects = new Set(effectIdeas.map(x => x.name));
  const plannedCaps = new Set(capabilityIdeas.map(x => x.name));
  for (const c of capabilityIdeas) for (const e of c.effects ?? []) if (!plannedEffects.has(e) && !originalEffects.some(x=>x.name===e&&x.isPublic)) throw new Error(`Missing effect ${e}`);
  for (const h of heritageRecipes) for (const c of h.capabilities) if (!plannedCaps.has(c) && !originalCaps.some(x=>x.name===c&&x.isPublic)) throw new Error(`Missing capability ${c}`);
  const recipeIds = unique(heritageRecipes.map(x=>`${x.kind}:${x.name}`));
  if (recipeIds.length !== 90) throw new Error("Duplicate heritage recipe");
  const plannedCosts = new Map<string, number>([...p.values()].map(x=>[x.name,x.buCost]));
  for(const idea of permissions)plannedCosts.set(idea.name,idea.bu);
  const audit = heritageRecipes.map(recipe=>{
    const parts=unique([...recipe.primitives,...recipe.capabilities.flatMap(name=>{
      const cap=capabilityIdeas.find(x=>x.name===name)!;
      return [...cap.primitives,...(cap.effects??[]).flatMap(e=>effectIdeas.find(x=>x.name===e)!.primitives)];
    })]);
    const cost=parts.reduce((sum,name)=>sum+(plannedCosts.get(name)??0),0);
    return {kind:recipe.kind,name:recipe.name,cost,target:conceptMap.get(recipe.name)!.targetBu,parts:parts.length};
  });
  const discrepancy=audit.filter(x=>Math.abs(x.cost-x.target)>12);
  console.log(`Preflight: ${permissions.length} primitive permissions, ${effectIdeas.length} effects, ${capabilityIdeas.length} capabilities, ${heritageRecipes.length} heritages. Existing catalog: ${originalPrimitives.length}/${originalEffects.length}/${originalCaps.length}/${originalHeritages.length}.`);
  console.log(`Recipe BU range ${Math.min(...audit.map(x=>x.cost))}–${Math.max(...audit.map(x=>x.cost))}; ${discrepancy.length} differ from concept target by >12 BU.`);
  if (!apply) { for(const row of audit)console.log(`${row.kind} ${row.name}: ${row.cost} BU / concept ${row.target}`); console.log("DRY RUN ONLY. Pass --apply to save after reviewing the recipes."); return; }

  await withDatabaseTransaction(async () => {
    // A private generic parent captures the base authoring family for
    // occupational/narrative permissions, without adding a purchasable row.
    let practical = originalPrimitives.find(x => x.sourceOrigin === `${prefix}practical-parent`);
    if (!practical) {
      const source = pById.get(21351)!;
      const candidate: Primitive = { ...source, id: 0, name: "Bounded Practical Permission", userId: null, isPublic: false,
        sourceOrigin: `${prefix}practical-parent`, definitionKind: "TEMPLATE", templatePrimitiveId: null,
        bindingSchema: {}, bindings: {}, buCost: 0, costTier: "Template — no purchase cost",
        mechanicalRule: { family: "DESCRIPTIVE" }, mechanicalTemplateText: "", mechanicalOutputText: "Describe a bounded practical or fictional permission.",
        narrativeRule: "Base family for a narrow practical or fictional permission. An expression supplies its specific action, material, target, limit, and cost.",
        hardModifiers: [], isMirrorable: false, mirrorVector: "STANDARD_ONLY", mirrorBuCredit: 0,
        mirrorEligibilityNotes: "Descriptive permissions are not mirrored weaknesses.", contentHash: null, createdAt: new Date(), updatedAt: new Date() };
      const hash = await hashPrimitiveContent(buildCanonicalPrimitivePayload(candidate));
      const [created] = await db.insert(primitives).values({ ...candidate, id: undefined, contentHash: hash }).returning();
      practical = created!;
      await saveVersion("primitive", practical.id, hash, buildCanonicalPrimitivePayload(practical) as unknown as Record<string,unknown>);
      await db.insert(primitiveMarketClassifications).values({ primitiveId: practical.id, familyKey: "HERITAGE_AUGMENT", tier: 0,
        expressionKey: "bounded-practical-permission-parent", canonicalTemplateId: practical.id, source: "INHERITED", status: "CLASSIFIED", evidence: { curatedPhase: 4, role: "template" } });
    }
    pById.set(practical.id, practical);
    for (const idea of permissions) {
      const origin = `${prefix}permission:${slug(idea.name)}`;
      const existing = originalPrimitives.find(x => x.sourceOrigin === origin);
      if (existing) { p.set(idea.name,existing); continue; }
      if (p.has(idea.name)) throw new Error(`Public primitive name collision ${idea.name}`);
      const parentSpec = parentFor(idea.name);
      const parent = pById.get(parentSpec.id === "practical" ? practical.id : parentSpec.id)!;
      const candidate: Primitive = { ...parent, id: 0, name: idea.name, userId: null, isPublic: true, sourceOrigin: origin,
        definitionKind: "EXPRESSION", templatePrimitiveId: parent.definitionKind === "TEMPLATE" ? parent.id : parent.templatePrimitiveId,
        bindingSchema: {}, bindings: {}, buCost: idea.bu, costTier: `Tier ${tier(idea.bu)} — author price ${idea.bu} BU`,
        mechanicalRule: { family: "DESCRIPTIVE" }, mechanicalTemplateText: "", mechanicalOutputText: idea.rule,
        narrativeRule: idea.rule, hardModifiers: [], isMirrorable: false, mirrorVector: "STANDARD_ONLY", mirrorBuCredit: 0,
        mirrorEligibilityNotes: "This bounded permission has no numerical operator to mirror.", contentHash: null, createdAt: new Date(), updatedAt: new Date() };
      const payload = buildCanonicalPrimitivePayload(candidate);
      const hash = await hashPrimitiveContent(payload);
      const [created] = await db.insert(primitives).values({ ...candidate, id: undefined, contentHash: hash }).returning();
      if (!created) throw new Error(`Primitive insert failed ${idea.name}`);
      const v = await saveVersion("primitive",created.id,hash,payload as unknown as Record<string,unknown>);
      const [pv] = await db.select({ id: primitiveVersions.id }).from(primitiveVersions).where(and(eq(primitiveVersions.primitiveId,parent.id),eq(primitiveVersions.isLatest,true))).limit(1);
      if (!pv) throw new Error(`Missing parent version ${parent.name}`);
      await db.insert(forks).values({ forkedByUserId: actor.id, sourceTargetType: "PRIMITIVE", sourceTargetId: String(parent.id),
        sourceVersionId: pv.id, sourceAuthorId: null, forkedTargetType: "PRIMITIVE", forkedTargetId: String(created.id), forkedVersionId: v.id,
        metadata: { curatedPhase: 4, boundedPermission: true } });
      await db.insert(primitiveMarketClassifications).values({ primitiveId: created.id, familyKey: parentSpec.family, tier: tier(idea.bu),
        expressionKey: slug(idea.name), canonicalTemplateId: parent.definitionKind === "TEMPLATE" ? parent.id : parent.templatePrimitiveId,
        canonicalExpressionId: created.id, source: "INHERITED", status: "CLASSIFIED", evidence: { parentId: parent.id, curatedPhase: 4 } });
      await publish("PRIMITIVE",String(created.id),v.id,v.number);
      p.set(idea.name,created); pById.set(created.id,created);
    }
    const e = new Map<string,Effect>();
    for (const idea of effectIdeas) {
      const origin = `${prefix}effect:${slug(idea.name)}`;
      const existing = originalEffects.find(x=>x.sourceOrigin===origin);
      if (!existing&&originalEffects.some(x=>x.name===idea.name&&x.isPublic)) throw new Error(`Effect name collision ${idea.name}`);
      const ids = unique(idea.primitives.map(name=>p.get(name)?.id ?? 0));
      if (ids.includes(0)) throw new Error(`Unresolved effect ${idea.name}`);
      const payload=buildCanonicalEffectPayload({ name:idea.name,narrativeDescription:idea.text,tags:["curated"],isPublic:true,
        primitiveSlots:ids.map(primitiveId=>({primitiveId,quantity:1,notes:""})) });
      const hash=await hashEffectContent(payload);
      if(existing?.contentHash===hash){e.set(idea.name,existing);continue;}
      const [row]=existing
        ? await db.update(effects).set({narrativeDescription:idea.text,tags:["curated"],contentHash:hash,updatedAt:new Date()}).where(eq(effects.id,existing.id)).returning()
        : await db.insert(effects).values({name:idea.name,userId:null,isPublic:true,sourceOrigin:origin,
            narrativeDescription:idea.text,tags:["curated"],contentHash:hash}).returning();
      if (!row) throw new Error(`Effect save failed ${idea.name}`);
      if(existing)await db.delete(effectPrimitives).where(eq(effectPrimitives.effectId,row.id));
      await db.insert(effectPrimitives).values(ids.map((primitiveId,sortOrder)=>({effectId:row.id,primitiveId,sortOrder,targetWho:idea.target})));
      const v=await saveVersion("effect",row.id,hash,payload as unknown as Record<string,unknown>);
      await publish("EFFECT",row.id,v.id,v.number);
      e.set(idea.name,row);
    }
    const c = new Map<string,Capability>();
    for (const idea of capabilityIdeas) {
      const origin = `${prefix}capability:${slug(idea.name)}`;
      const existing=originalCaps.find(x=>x.sourceOrigin===origin);
      if(!existing&&originalCaps.some(x=>x.name===idea.name&&x.isPublic))throw new Error(`Capability name collision ${idea.name}`);
      const prims=unique(idea.primitives.map(name=>p.get(name)?.id??0));
      const effectIds=unique((idea.effects??[]).map(name=>e.get(name)?.id??""));
      if(prims.includes(0)||effectIds.includes(""))throw new Error(`Unresolved capability ${idea.name}`);
      const fullCostIds=new Set(prims);
      for(const effectName of idea.effects??[])for(const primitiveName of effectIdeas.find(x=>x.name===effectName)!.primitives)fullCostIds.add(p.get(primitiveName)!.id);
      const totalBu=[...fullCostIds].reduce((sum,id)=>sum+pById.get(id)!.buCost,0);
      const slots=prims.map(id=>({primitiveId:id,role:role(pById.get(id)!),quantity:1,slotLabel:"",notes:""}));
      const payload=buildCanonicalCapabilityPayload({name:idea.name,type:idea.type??"ACTIVE",sourceType:idea.source??"PHYSICAL",
        verboseDescription:idea.text,tags:["curated"],isPublic:true,primitiveSlots:slots,effectIds});
      const hash=await hashCapabilityContent(payload);
      if(existing?.contentHash===hash){
        if(existing.metadata?.totalBu!==totalBu)await db.update(capabilities).set({metadata:{...existing.metadata,totalBu},updatedAt:new Date()}).where(eq(capabilities.id,existing.id));
        c.set(idea.name,existing);continue;
      }
      const [row]=existing
        ? await db.update(capabilities).set({type:idea.type??"ACTIVE",sourceType:idea.source??"PHYSICAL",verboseDescription:idea.text,
            tags:["curated"],metadata:{...existing.metadata,totalBu},contentHash:hash,updatedAt:new Date()}).where(eq(capabilities.id,existing.id)).returning()
        : await db.insert(capabilities).values({name:idea.name,userId:null,isPublic:true,sourceOrigin:origin,
            type:idea.type??"ACTIVE",sourceType:idea.source??"PHYSICAL",verboseDescription:idea.text,tags:["curated"],metadata:{totalBu},contentHash:hash}).returning();
      if(!row)throw new Error(`Capability save failed ${idea.name}`);
      if(existing){await db.delete(capabilityPrimitives).where(eq(capabilityPrimitives.capabilityId,row.id));await db.delete(capabilityEffects).where(eq(capabilityEffects.capabilityId,row.id));}
      if(slots.length)await db.insert(capabilityPrimitives).values(slots.map((s,sortOrder)=>({capabilityId:row.id,primitiveId:s.primitiveId,role:s.role,quantity:1,sortOrder,slotLabel:"",notes:""})));
      if(effectIds.length)await db.insert(capabilityEffects).values(effectIds.map((effectId,sortOrder)=>({capabilityId:row.id,effectId,sortOrder})));
      const v=await saveVersion("capability",row.id,hash,payload as unknown as Record<string,unknown>);
      await publish("CAPABILITY",row.id,v.id,v.number);
      c.set(idea.name,row);
    }
    let updated=0,createdCount=0;
    for(const recipe of heritageRecipes){
      const origin=`${prefix}${recipe.kind.toLowerCase()}:${slug(recipe.name)}`;
      const existing=originalHeritages.find(x=>x.name===recipe.name&&x.kind===recipe.kind&&x.isPublic&&x.userId===null);
      const collision=originalHeritages.find(x=>x.name===recipe.name&&x.kind===recipe.kind&&x.isPublic&&x.userId!==null);
      if(collision&&!existing)throw new Error(`User heritage collision ${recipe.name}`);
      const directIds=unique(recipe.primitives.map(name=>p.get(name)?.id??0));
      const capIds=unique(recipe.capabilities.map(name=>c.get(name)?.id??""));
      if(directIds.includes(0)||capIds.includes(""))throw new Error(`Unresolved heritage ${recipe.name}`);
      const allIds=new Set(directIds);
      for(const name of recipe.capabilities){
        const idea=capabilityIdeas.find(x=>x.name===name)!;
        for(const primitiveName of idea.primitives)allIds.add(p.get(primitiveName)!.id);
        for(const effectName of idea.effects??[])for(const primitiveName of effectIdeas.find(x=>x.name===effectName)!.primitives)allIds.add(p.get(primitiveName)!.id);
      }
      const price=[...allIds].reduce((sum,id)=>sum+(pById.get(id)?.buCost??0),0);
      const concept=conceptMap.get(recipe.name)!;
      const description=describe(recipe.name,concept.text,price,[...allIds].map(id=>pById.get(id)!.name),recipe.capabilities);
      const suggestedTraits=existing?.suggestedTraits??"";
      const payload=buildCanonicalTemplatePayload({kind:recipe.kind,name:recipe.name,description,suggestedTraits,isPublic:true,
        primitiveIds:directIds,primitiveSlots:directIds.map(primitiveId=>({primitiveId,isMirrored:false})),capabilityIds:capIds});
      const hash=await hashTemplateContent(payload);
      if(existing?.contentHash===hash){
        console.log(`${recipe.kind} ${recipe.name}: already current (${price} BU)`);
        continue;
      }
      let row:Heritage;
      if(existing){
        [row]=await db.update(heritage).set({description,suggestedTraits,isPublic:true,sourceOrigin:existing.sourceOrigin??origin,
          tags:unique([...(existing.tags??[]),"curated"]),contentHash:hash,updatedAt:new Date()}).where(eq(heritage.id,existing.id)).returning();
        await db.delete(heritagePrimitives).where(eq(heritagePrimitives.templateId,row.id));
        await db.delete(heritageCapabilities).where(eq(heritageCapabilities.templateId,row.id));
        updated++;
      }else{
        [row]=await db.insert(heritage).values({name:recipe.name,kind:recipe.kind,userId:null,isPublic:true,sourceOrigin:origin,
          description,suggestedTraits,tags:["curated"],contentHash:hash}).returning();
        createdCount++;
      }
      if(directIds.length)await db.insert(heritagePrimitives).values(directIds.map((primitiveId,sortOrder)=>({templateId:row.id,primitiveId,sortOrder})));
      if(capIds.length)await db.insert(heritageCapabilities).values(capIds.map(capabilityId=>({templateId:row.id,capabilityId})));
      const v=await saveVersion("template",row.id,hash,payload as unknown as Record<string,unknown>);
      await publish(kindTarget(recipe.kind),row.id,v.id,v.number);
      console.log(`${recipe.kind} ${recipe.name}: ${price} BU (concept target ${concept.targetBu}), ${allIds.size} unique primitives`);
    }
    console.log(`Saved heritage shelf: ${createdCount} new, ${updated} repaired.`);
  });
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await pool.end()});
