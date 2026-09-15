/**
 * V12 Library catalog + grammar migration.
 * Default is a read-only audit. Pass --apply after reviewing the report.
 */
import { and, eq, inArray, sql } from "drizzle-orm";
import { db, pool } from "../src/db/client";
import {
  forkAggregates,
  forks,
  lexiconFamilies,
  primitiveMarketClassifications,
  primitives,
  primitiveVersions,
  users,
} from "../src/db/schema";
import { CANONICAL_EXPRESSIONS, familyForCategory, MARKET_FAMILIES, MARKET_TEMPLATES } from "../src/lib/primitives/canonical-market";
import { mechanicalDescriptionFromModifiers, mechanicalRuleFromModifier, renderMechanicalRule } from "../src/lib/primitives/mechanical-rule";
import type { HardModifier } from "../src/types/swordweave";
import { isDeepStrictEqual } from "node:util";

const apply = process.argv.includes("--apply");
type Report = {
  families:number; templates:number; expressions:number; versions:number;
  classifications:number; lineage:number; ambiguous:Array<{id:number;name:string;reason:string}>;
  orphans:Array<{id:number;source:string}>; selfForks:Array<{id:number;source:string}>;
};
const report:Report={families:0,templates:0,expressions:0,versions:0,classifications:0,lineage:0,ambiguous:[],orphans:[],selfForks:[]};

function expressionRule(template:typeof MARKET_TEMPLATES[number], bindings:Record<string,string>) {
  return {...template.rule, bindings};
}

function hardModifierFor(templateKey:string, bindings:Record<string,string>):readonly HardModifier[] {
  if (templateKey === "attribute-increment") return [{kind:"modify",target:"attribute",operation:"add",value:{kind:"number",value:1},stacking:"stack",metadata:{targetScope:{layer:"ATTRIBUTE",values:[bindings.attribute!] as string[]},recipient:"SELF"}}];
  if (templateKey === "defensive-save-upgrade") return [{kind:"modify",target:"action_roll",operation:"grant",value:{kind:"keyword",text:"proficiency"},stacking:"highest-only",metadata:{targetScope:{layer:"ATTRIBUTE",values:[bindings.attribute!] as string[]},recipient:"SELF"}}];
  if (templateKey === "practice-proficiency") return [{kind:"modify",target:"skill_practice_check",operation:"grant",value:{kind:"derived",which:"pb"},stacking:"highest-only",metadata:{targetScope:{layer:"PRACTICE",values:[bindings.practice!] as string[]},recipient:"SELF"}}];
  return [];
}

function tierFromCost(cost:number):number|null {
  if (cost <= 4) return 1; if (cost <= 8) return 2; if (cost <= 16) return 3; if (cost > 16) return 4; return null;
}

const normalizeKey=(value:string)=>value.normalize("NFKC").trim().toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
const hasUnfilledPlaceholder=(value:string)=>/\[(?:target|value|attribute|practice|domain|keyword|scope|recipient)\]/i.test(value);
type ContentRepair={mechanical:string;narrative:string;descriptiveOnly?:boolean};
const CONTENT_REPAIRS:Record<string,ContentRepair>={
  "metallic-masticators":{
    mechanical:"", descriptiveOnly:true,
    narrative:"Your teeth are fused with a supernatural metal alloy. From level 6 onward, you can bite through plate armor; at level 16, you can crack diamond. This expands what your bite can physically penetrate and does not add a numeric roll modifier by itself.",
  },
  "combat-commands":{
    mechanical:"A creature that understands your spoken language must follow a combat-related command you issue while it is affected.",
    narrative:"Your taunting voice carries supernatural authority. Anyone who can understand your words can be compelled to carry out a clear combat-related command, subject to the capability's targeting, resistance, and duration rules.",
  },
  "big-bear-belly":{
    mechanical:"Add +1 to Physical.",
    narrative:"A massive, powerful bear build permanently increases your Physical attribute by 1. The increase affects every derived value and check that uses Physical.",
  },
  "enfeebling-envenom":{
    mechanical:"When your neurotoxic bite exposes a target, reduce that target's Save DC by 1.",
    narrative:"Your bite delivers a powerful neurotoxin that applies the Exposed condition. While exposed by this venom, the victim's Save DC is reduced by 1, making its own effects easier to resist.",
  },
  "infallible-folicles":{
    mechanical:"Add +1 to Save DC.",
    narrative:"Chitinous fur reinforces the force behind your abilities, permanently increasing your Save DC by 1. Opponents must meet the higher DC when resisting your effects.",
  },
  "bodily-boon":{
    mechanical:"Grant advantage on Prowess, Finesse, and Fieldcraft checks.",
    narrative:"Your body is unusually capable across force, precision, and practical movement. You roll with advantage on Prowess, Finesse, and Fieldcraft checks.",
  },
  "innate-instinct":{
    mechanical:"Treat an Intuition check result lower than 10 as 10.",
    narrative:"Your instincts remain dependable even under pressure. Whenever an Intuition check would produce a result below 10, use 10 instead before applying any other relevant adjustments.",
  },
  "thaumaturgic-tracker":{
    mechanical:"Grant expertise on Awareness checks involving magical effects, objects, or spells.",
    narrative:"You are trained to notice magical residue, active spells, enchanted objects, and other thaumaturgic signs. Apply expertise when an Awareness check depends on detecting or interpreting such evidence.",
  },
  "corenered-combatant":{
    mechanical:"Grant expertise on melee attack rolls, including attacks made with melee weapons or firearms used at melee range.",
    narrative:"Close pressure sharpens your fighting instincts. Apply expertise to melee attack rolls, including conventional melee weapons and guns used in close combat.",
  },
  "cornered-combatant":{
    mechanical:"Grant expertise on melee attack rolls, including attacks made with melee weapons or firearms used at melee range.",
    narrative:"Close pressure sharpens your fighting instincts. Apply expertise to melee attack rolls, including conventional melee weapons and guns used in close combat.",
  },
  "mental-inclination":{
    mechanical:"Grant proficiency on Awareness, Reason, Knowledge, and Influence checks.",
    narrative:"Your mind is broadly trained across the mental practices. You gain proficiency on Awareness, Reason, Knowledge, and Influence checks.",
  },
  "mental-muscle-mass":{
    mechanical:"Add half your Mental attribute to Prowess, Finesse, and Fieldcraft checks. Your telekinetic lifting capacity is twice your physical lifting capacity.",
    narrative:"Your mental force acts like an amplified second musculature. If you can lift 200 kg physically, you can lift 400 kg telekinetically. Your Physical score itself does not change; half your Mental attribute is added to Prowess, Finesse, and Fieldcraft checks.",
  },
  "domain-of-gravity-and-space":{
    mechanical:"Grant [gravity-and-space] domain access.",
    narrative:"This Tier III domain covers gravity and spatial relationships: weight, attraction, repulsion, orientation, distance, position, local geometry, and bounded distortions of space. It grants vocabulary for building capabilities in that domain; their verb tier, range, target, duration, and other primitives still determine what each capability can do.",
  },
  "domain-of-pressure":{
    mechanical:"Grant [pressure] domain access.",
    narrative:"This domain covers pressure in gases and liquids, including air pressure, compression, decompression, currents, shock fronts, and pressure differentials. It grants vocabulary for pressure-based capabilities; their verb tier and other composition primitives set the actual action and limits.",
  },
  "domain-of-metal":{
    mechanical:"Grant [metal] domain access.",
    narrative:"This domain covers metal as a directly observable material: sensing it and using permitted verbs to move, shape, join, separate, heat, cool, or otherwise affect it. The capability's verb tier and other primitives determine which interactions are available and at what scale.",
  },
  "domain-of-thought":{
    mechanical:"Grant [thought] domain access.",
    narrative:"This Tier III domain covers thoughts, conscious intent, ideas, attention, and bounded mental information. It grants vocabulary for thought-based capabilities; targeting, resistance, agency, duration, and other primitives determine how a specific capability may affect a mind.",
  },
  "verb-access-tier-i":{
    mechanical:"", descriptiveOnly:true,
    narrative:"Unlock the complete Tier I verb vocabulary for basic physical and perceptual interaction: move, strike, push, pull, lift, drop, interact, sense, observe, touch, grab, throw, break, hold, release, dodge, crawl, run, and similarly direct actions. Buying this primitive grants the whole tier; it is not the purchase of a single verb.",
  },
  "verb-access-tier-ii":{
    mechanical:"", descriptiveOnly:true,
    narrative:"Unlock the complete Tier II verb vocabulary for changing existing states and properties: alter, combine, separate, enhance, weaken, suppress, extend, compress, reshape, redirect, convert, stabilize, amplify, reduce, transfer, infuse, extract, bind, disrupt, and channel. Buying this primitive grants the whole tier; it is not the purchase of a single verb.",
  },
  "backpack":{mechanical:"Add +20 to Carry Capacity.",narrative:"A backpack expands how much carried Load you can support. While it is available for use, add 20 to Carry Capacity."},
  "extra-slot":{mechanical:"Add +1 Equipped Slot.",narrative:"This augment creates room to keep one additional item equipped and ready. Increase your maximum Equipped Slots by 1."},
  "lighten":{mechanical:"Subtract 2 from this item's Load.",narrative:"The item is made easier to carry through compact construction or supernatural lightening. Reduce this item's Load by 2, to the system's minimum allowed Load."},
  "heavy-die-block-1d8":{mechanical:"Unlock 1d8 damage or healing output.",narrative:"Use a d8 when this capability produces a heavy but still conventional amount of damage or healing. The die inherits the capability's execution source, target, range, and delivery rules."},
  "impact-die-block-1d10":{mechanical:"Unlock 1d10 damage or healing output.",narrative:"Use a d10 for concentrated, high-impact damage or healing beyond the standard d8 ceiling. The die supplies output intensity while the rest of the capability defines delivery and targets."},
  "calamity-die-block-1d12":{mechanical:"Unlock 1d12 damage or healing output.",narrative:"Use a d12 for exceptional damage or healing capable of defining a major threat or decisive intervention. The die sets intensity; the capability's other primitives still govern source, range, targets, and timing."},
};
function tierFromRow(row:typeof primitives.$inferSelect) {
  const match=row.costTier.match(/tier\s*(\d+)/i); return match ? Number(match[1]) : tierFromCost(row.buCost);
}
function inferredBinding(row:typeof primitives.$inferSelect):Record<string,string> {
  if (row.category === "DOMAIN") {
    const name=/^domain\s+o(?:f|d)\s+(.+?)(?:\s*\(fork\))?$/i.exec(row.name)?.[1];
    const output=/grant\s+\[?([^\]]+?)\]?\s+domain access/i.exec(row.mechanicalOutputText)?.[1];
    const domain=String((row.bindings as Record<string,unknown>)?.["domain"] ?? output ?? name ?? "").trim();
    return domain ? {domain:normalizeKey(domain)} : {};
  }
  const binding=(row.bindings ?? {}) as Record<string,unknown>;
  return Object.fromEntries(Object.entries(binding).filter(([,value])=>typeof value === "string")) as Record<string,string>;
}

async function latestVersion(tx:typeof db, primitiveId:number) {
  return tx.query.primitiveVersions.findFirst({where:(t,{eq})=>eq(t.primitiveId,primitiveId),orderBy:(t,{desc})=>desc(t.versionNumber)});
}

async function ensureVersion(tx:typeof db, primitive:typeof primitives.$inferSelect, changed:boolean) {
  const latest=await latestVersion(tx,primitive.id);
  if (!changed && latest) return latest;
  const snapshot={...primitive};
  if (latest) await tx.update(primitiveVersions).set({isLatest:false,supersededAt:new Date()}).where(eq(primitiveVersions.id,latest.id));
  const [created]=await tx.insert(primitiveVersions).values({primitiveId:primitive.id,versionNumber:(latest?.versionNumber ?? 0)+1,isLatest:true,deltaKind:"FULL",snapshot}).returning();
  report.versions++; return created!;
}

async function migrate(tx:typeof db) {
  for (const family of MARKET_FAMILIES) {
    report.families++;
    if (apply) await tx.insert(lexiconFamilies).values({key:family.key,label:family.label,chapter:family.chapter,chapterOrder:family.chapterOrder,familyOrder:family.familyOrder,description:"",aliases:family.aliases ?? []}).onConflictDoUpdate({target:lexiconFamilies.key,set:{label:family.label,chapter:family.chapter,chapterOrder:family.chapterOrder,familyOrder:family.familyOrder,aliases:family.aliases ?? [],updatedAt:new Date()}});
  }

  const actor=(await tx.select({id:users.id}).from(users).where(eq(users.isAdmin,true)).limit(1))[0];
  const adminRows=await tx.select({clerkUserId:users.clerkUserId}).from(users).where(eq(users.isAdmin,true));
  const adminClerkIds=adminRows.map(row=>row.clerkUserId).filter((id):id is string=>Boolean(id));
  if (!actor && apply) throw new Error("At least one admin user is required to attribute canonical fork edges");

  // Deterministic repairs discovered during the production catalog audit.
  // Snapshot the bad state first, then create an immutable corrected version.
  if (apply) {
    const repairs = await tx.select().from(primitives).where(sql`${primitives.name} IN ('Bodily boon','Enfeebling Envenom') OR ${primitives.name} LIKE 'Structure Tier %' OR ${primitives.category}='ITEM_AUGMENT'`);
    for (const row of repairs) {
      // Catalog-managed rows are already normalized below. Reprocessing them
      // here would make the legacy modifier renderer and canonical sentence
      // renderer overwrite one another on every run.
      if (row.sourceOrigin?.startsWith("system:v12:")) continue;
      if (CONTENT_REPAIRS[normalizeKey(row.name)]) continue;
      const isStructure=/^Structure Tier /i.test(row.name);
      const isBodily=row.name.toLowerCase()==="bodily boon";
      const isEnvenom=row.name.toLowerCase()==="enfeebling envenom";
      const modifiers=(row.hardModifiers ?? []) as HardModifier[];
      const mechanical=mechanicalDescriptionFromModifiers(modifiers);
      const nextCategory = isStructure ? "STRUCTURAL" : isBodily ? "PROBABILITY_BIAS" : isEnvenom ? "SHEET_AUGMENT" : row.category;
      const shouldPublish = row.category === "ITEM_AUGMENT" && (row.userId===null || adminClerkIds.includes(row.userId ?? ""));
      const changed = nextCategory!==row.category || Boolean(mechanical && mechanical!==row.mechanicalOutputText) || (shouldPublish && !row.isPublic);
      if (!changed) continue;
      await ensureVersion(tx,row,false);
      const [updated]=await tx.update(primitives).set({
        category:nextCategory as typeof primitives.$inferInsert.category,
        ...(mechanical ? {mechanicalRule:mechanicalRuleFromModifier(modifiers[0]!) as Record<string,unknown>,mechanicalOutputText:mechanical} : {}),
        ...(shouldPublish ? {isPublic:true} : {}),
        updatedAt:new Date(),
      }).where(eq(primitives.id,row.id)).returning();
      await ensureVersion(tx,updated!,true);
    }
  }

  const templateIds=new Map<string,number>();
  for (const template of MARKET_TEMPLATES) {
    const existing=(await tx.select().from(primitives).where(and(eq(primitives.name,template.name),sql`${primitives.category}::text = ${template.category}`)).orderBy(sql`${primitives.userId} NULLS FIRST`).limit(1))[0];
    if (!existing) { report.ambiguous.push({id:0,name:template.name,reason:"canonical template missing"}); continue; }
    report.templates++; templateIds.set(template.key,existing.id);
    const text=renderMechanicalRule(template.rule);
    const changed=existing.definitionKind!=="TEMPLATE" || existing.mechanicalTemplateText!==text || existing.mechanicalOutputText!==text || existing.narrativeRule!==template.verboseDescription;
    let row=existing;
    if (apply) {
      [row]=await tx.update(primitives).set({definitionKind:"TEMPLATE",templatePrimitiveId:null,bindingSchema:template.bindingSchema,bindings:{},mechanicalRule:template.rule as Record<string,unknown>,mechanicalTemplateText:text,mechanicalOutputText:text,narrativeRule:template.verboseDescription,updatedAt:new Date()}).where(eq(primitives.id,existing.id)).returning();
      await tx.insert(primitiveMarketClassifications).values({primitiveId:existing.id,familyKey:template.familyKey,tier:template.tier,expressionKey:null,canonicalTemplateId:existing.id,canonicalExpressionId:null,source:"CATALOG",status:"CLASSIFIED",evidence:{catalogKey:template.key}}).onConflictDoUpdate({target:primitiveMarketClassifications.primitiveId,set:{familyKey:template.familyKey,tier:template.tier,expressionKey:null,canonicalTemplateId:existing.id,source:"CATALOG",status:"CLASSIFIED",evidence:{catalogKey:template.key},updatedAt:new Date()}});
      await ensureVersion(tx,row!,changed);
    }
    report.classifications++;
  }

  for (const template of MARKET_TEMPLATES) for (const binding of template.standardBindings ?? []) {
    const templateId=templateIds.get(template.key); if (!templateId) continue;
    report.expressions++;
    const sourceOrigin=`system:v12:${template.key}:${binding.key}`;
    const rule=expressionRule(template,binding.bindings);
    const contentRepair=CONTENT_REPAIRS[normalizeKey(binding.name)];
    const text=contentRepair?.mechanical ?? renderMechanicalRule(rule);
    const narrative=contentRepair?.narrative ?? binding.verboseDescription ?? template.verboseDescription;
    const namedCandidates=await tx.select().from(primitives).where(and(eq(primitives.name,binding.name),sql`${primitives.category}::text=${template.category}`)).limit(20);
    const existing=(await tx.select().from(primitives).where(eq(primitives.sourceOrigin,sourceOrigin)).limit(1))[0]
      ?? namedCandidates.find(row=>row.userId===null || adminClerkIds.includes(row.userId ?? ""));
    let row=existing;
    let changed=false;
    if (apply) {
      if (existing) {
        changed=existing.mechanicalOutputText!==text || existing.templatePrimitiveId!==templateId || existing.narrativeRule!==narrative;
        [row]=await tx.update(primitives).set({name:binding.name,isPublic:true,definitionKind:"EXPRESSION",templatePrimitiveId:templateId,bindingSchema:{},bindings:binding.bindings,mechanicalRule:rule as Record<string,unknown>,mechanicalTemplateText:"",mechanicalOutputText:text,narrativeRule:narrative,hardModifiers:hardModifierFor(template.key,binding.bindings),sourceOrigin,updatedAt:new Date()}).where(eq(primitives.id,existing.id)).returning();
      } else {
        [row]=await tx.insert(primitives).values({name:binding.name,userId:null,isPublic:true,category:template.category as typeof primitives.$inferInsert.category,costTier:`Tier ${template.tier ?? 1}`,buCost:template.buCost,definitionKind:"EXPRESSION",templatePrimitiveId:templateId,bindingSchema:{},bindings:binding.bindings,mechanicalRule:rule as Record<string,unknown>,mechanicalOutputText:text,narrativeRule:narrative,hardModifiers:hardModifierFor(template.key,binding.bindings),sourceOrigin}).returning();
        changed=true;
      }
      const version=await ensureVersion(tx,row!,changed);
      await tx.insert(primitiveMarketClassifications).values({primitiveId:row!.id,familyKey:template.familyKey,tier:template.tier,expressionKey:binding.key,canonicalTemplateId:templateId,canonicalExpressionId:row!.id,source:"CATALOG",status:"CLASSIFIED",evidence:{catalogKey:template.key,binding:binding.key}}).onConflictDoUpdate({target:primitiveMarketClassifications.primitiveId,set:{familyKey:template.familyKey,tier:template.tier,expressionKey:binding.key,canonicalTemplateId:templateId,canonicalExpressionId:row!.id,source:"CATALOG",status:"CLASSIFIED",evidence:{catalogKey:template.key,binding:binding.key},updatedAt:new Date()}});
      const sourceVersion=await ensureVersion(tx,(await tx.select().from(primitives).where(eq(primitives.id,templateId)).limit(1))[0]!,false);
      const edge=(await tx.select({id:forks.id}).from(forks).where(and(eq(forks.sourceTargetType,"PRIMITIVE"),eq(forks.sourceTargetId,String(templateId)),eq(forks.forkedTargetType,"PRIMITIVE"),eq(forks.forkedTargetId,String(row!.id)))).limit(1))[0];
      if (!edge) { await tx.insert(forks).values({forkedByUserId:actor!.id,sourceTargetType:"PRIMITIVE",sourceTargetId:String(templateId),sourceVersionId:sourceVersion.id,sourceAuthorId:null,forkedTargetType:"PRIMITIVE",forkedTargetId:String(row!.id),forkedVersionId:version.id,metadata:{canonical:true,binding:binding.key}}); report.lineage++; }
    }
    report.classifications++;
  }

  for (const expression of CANONICAL_EXPRESSIONS) {
    report.expressions++;
    const sourceOrigin=`system:v12:expression:${expression.key}`;
    const candidates=await tx.select().from(primitives).where(and(eq(primitives.name,expression.name),sql`${primitives.category}::text=${expression.category}`)).limit(10);
    const existing=(await tx.select().from(primitives).where(eq(primitives.sourceOrigin,sourceOrigin)).limit(1))[0]
      ?? candidates.find(row=>row.userId===null || adminClerkIds.includes(row.userId ?? ""));
    if (apply) {
      const contentRepair=CONTENT_REPAIRS[normalizeKey(expression.name)];
      const mechanicalText=contentRepair?.mechanical ?? expression.mechanicalText;
      const narrative=contentRepair?.narrative ?? expression.verboseDescription;
      const mechanicalRule=mechanicalText ? {family:"DOCUMENTED" as const,text:mechanicalText} : {family:"DESCRIPTIVE" as const};
      const values={name:expression.name,isPublic:true,definitionKind:"EXPRESSION" as const,templatePrimitiveId:null,bindingSchema:{},bindings:{},mechanicalRule,mechanicalTemplateText:"",mechanicalOutputText:mechanicalText,narrativeRule:narrative,hardModifiers:expression.modifier ? [expression.modifier] : [],sourceOrigin,updatedAt:new Date()};
      let row; let changed=true;
      if(existing){ changed=existing.mechanicalOutputText!==values.mechanicalOutputText || existing.narrativeRule!==narrative || existing.definitionKind!=="EXPRESSION" || !isDeepStrictEqual(existing.mechanicalRule,mechanicalRule); [row]=await tx.update(primitives).set(values).where(eq(primitives.id,existing.id)).returning(); }
      else [row]=await tx.insert(primitives).values({...values,userId:null,category:expression.category as typeof primitives.$inferInsert.category,costTier:`Tier ${expression.tier ?? 0}`,buCost:expression.buCost}).returning();
      await ensureVersion(tx,row!,changed);
      await tx.insert(primitiveMarketClassifications).values({primitiveId:row!.id,familyKey:expression.familyKey,tier:expression.tier,expressionKey:expression.key,canonicalTemplateId:null,canonicalExpressionId:row!.id,source:"CATALOG",status:"CLASSIFIED",evidence:{catalogKey:expression.key}}).onConflictDoUpdate({target:primitiveMarketClassifications.primitiveId,set:{familyKey:expression.familyKey,tier:expression.tier,expressionKey:expression.key,canonicalTemplateId:null,canonicalExpressionId:row!.id,source:"CATALOG",status:"CLASSIFIED",evidence:{catalogKey:expression.key},updatedAt:new Date()}});
    }
    report.classifications++;
  }

  const legacy=await tx.select().from(primitives);
  for (const row of legacy) {
    if (templateIds.has([...templateIds].find(([,id])=>id===row.id)?.[0] ?? "")) continue;
    if (row.sourceOrigin?.startsWith("system:v12:")) continue;
    const family=familyForCategory(row.category);
    if (!family) {
      report.ambiguous.push({id:row.id,name:row.name,reason:`no catalog family for ${row.category}`});
      continue;
    }
    const tier=tierFromRow(row);
    const bindings=inferredBinding(row);
    const expressionKey=Object.values(bindings)[0] ?? (row.name ? normalizeKey(row.name.replace(/\s*\(fork\)$/i,"")) : null);
    const template=MARKET_TEMPLATES.find(candidate=>candidate.familyKey===family.key && (candidate.tier===tier || candidate.tier===null));
    const canonicalTemplateId=template ? templateIds.get(template.key) ?? null : null;
    const isSystem=row.userId===null || adminClerkIds.includes(row.userId ?? "") || row.sourceOrigin?.startsWith("system");
    const complete=family.key!=="DOMAIN_ACCESS" || Boolean(bindings.domain);
    if (!complete) report.ambiguous.push({id:row.id,name:row.name,reason:"domain expression has no deterministic domain binding"});
    let mechanicalText=row.mechanicalOutputText;
    let mechanicalRule=row.mechanicalRule as Parameters<typeof renderMechanicalRule>[0] | null;
    const contentRepair=CONTENT_REPAIRS[normalizeKey(row.name)];
    const modifierText=mechanicalDescriptionFromModifiers((row.hardModifiers ?? []) as HardModifier[]);
    if (contentRepair) {
      mechanicalText=contentRepair.mechanical;
      mechanicalRule=contentRepair.descriptiveOnly
        ? {family:"DESCRIPTIVE"}
        : row.hardModifiers?.length
          ? mechanicalRule
          : {family:"DOCUMENTED",text:contentRepair.mechanical};
    } else if (isSystem && modifierText) {
      mechanicalRule=mechanicalRuleFromModifier((row.hardModifiers as HardModifier[])[0]!);
      mechanicalText=modifierText;
    } else if (isSystem && template && complete) {
      mechanicalRule=expressionRule(template,bindings);
      mechanicalText=renderMechanicalRule(mechanicalRule);
    } else if (isSystem) {
      const rendered=mechanicalRule ? renderMechanicalRule(mechanicalRule) : "";
      if (rendered && !hasUnfilledPlaceholder(rendered)) {
        mechanicalText=rendered;
      } else if (row.mechanicalOutputText && !hasUnfilledPlaceholder(row.mechanicalOutputText)) {
        mechanicalRule={family:"DOCUMENTED",text:row.mechanicalOutputText};
        mechanicalText=renderMechanicalRule(mechanicalRule);
      }
    }
    const changed=isSystem && complete && (
      row.definitionKind!=="EXPRESSION" || row.templatePrimitiveId!==canonicalTemplateId ||
      JSON.stringify(row.bindings)!==JSON.stringify(bindings) || row.mechanicalOutputText!==mechanicalText || !isDeepStrictEqual(row.mechanicalRule,mechanicalRule)
    );
    if (apply) {
      let updated=row;
      if (changed) {
        [updated]=await tx.update(primitives).set({definitionKind:"EXPRESSION",templatePrimitiveId:canonicalTemplateId,bindings,mechanicalRule:mechanicalRule as Record<string,unknown> | null,mechanicalOutputText:mechanicalText,updatedAt:new Date()}).where(eq(primitives.id,row.id)).returning();
        await ensureVersion(tx,updated!,true);
      }
      await tx.insert(primitiveMarketClassifications).values({
        primitiveId:row.id,familyKey:family.key,tier,expressionKey,
        canonicalTemplateId,canonicalExpressionId:isSystem && complete ? row.id : null,
        source:template && complete ? "BINDING" : row.sourceOrigin?.startsWith("fork:") ? "INHERITED" : "LEGACY",
        status:complete ? "CLASSIFIED" : "NEEDS_REVIEW",
        evidence:{category:row.category,bindings},
      }).onConflictDoUpdate({target:primitiveMarketClassifications.primitiveId,set:{familyKey:family.key,tier,expressionKey,canonicalTemplateId,canonicalExpressionId:isSystem&&complete?row.id:null,source:template&&complete?"BINDING":row.sourceOrigin?.startsWith("fork:")?"INHERITED":"LEGACY",status:complete?"CLASSIFIED":"NEEDS_REVIEW",evidence:{category:row.category,bindings},updatedAt:new Date()}});
    }
    report.classifications++;
  }

  // Player-facing language repairs come last so the generic legacy renderer
  // cannot reintroduce placeholders or overwrite deliberately descriptive
  // primitives. Valid hard modifiers remain authoritative for runtime use.
  if (apply) {
    const repairRows=await tx.select().from(primitives);
    for (const row of repairRows) {
      const repair=CONTENT_REPAIRS[normalizeKey(row.name)];
      if (!repair) continue;
      const nextRule=repair.descriptiveOnly
        ? {family:"DESCRIPTIVE"}
        : row.hardModifiers?.length || (row.mechanicalRule as {family?:string}|null)?.family==="DOMAIN_ACCESS"
          ? row.mechanicalRule
          : {family:"DOCUMENTED",text:repair.mechanical};
      const changed=row.mechanicalOutputText!==repair.mechanical || row.narrativeRule!==repair.narrative || !isDeepStrictEqual(row.mechanicalRule,nextRule);
      if (!changed) continue;
      await ensureVersion(tx,row,false);
      const [updated]=await tx.update(primitives).set({
        mechanicalOutputText:repair.mechanical,
        narrativeRule:repair.narrative,
        mechanicalRule:nextRule as Record<string,unknown>,
        updatedAt:new Date(),
      }).where(eq(primitives.id,row.id)).returning();
      await ensureVersion(tx,updated!,true);
    }
  }

  for (const row of legacy) {
    const source=row.sourceOrigin ?? "";
    const match=/^fork:(?:PRIMITIVE:)?(\d+)/.exec(source);
    if (match) {
      const parentId=Number(match[1]);
      if (parentId===row.id) {
        report.selfForks.push({id:row.id,source});
        if (apply && row.userId) {
          await ensureVersion(tx,row,false);
          const [repaired]=await tx.update(primitives).set({sourceOrigin:`user:${row.userId}`,updatedAt:new Date()}).where(eq(primitives.id,row.id)).returning();
          await ensureVersion(tx,repaired!,true);
        }
        continue;
      }
      const parent=legacy.find(p=>p.id===parentId);
      if (!parent) { report.orphans.push({id:row.id,source}); continue; }
      if (apply && actor) {
        const parentVersion=await ensureVersion(tx,parent,false); const childVersion=await ensureVersion(tx,row,false);
        const edge=(await tx.select({id:forks.id}).from(forks).where(and(eq(forks.sourceTargetType,"PRIMITIVE"),eq(forks.sourceTargetId,String(parentId)),eq(forks.forkedTargetType,"PRIMITIVE"),eq(forks.forkedTargetId,String(row.id)))).limit(1))[0];
        if (!edge) { await tx.insert(forks).values({forkedByUserId:actor.id,sourceTargetType:"PRIMITIVE",sourceTargetId:String(parentId),sourceVersionId:parentVersion.id,sourceAuthorId:null,forkedTargetType:"PRIMITIVE",forkedTargetId:String(row.id),forkedVersionId:childVersion.id,metadata:{legacyBackfill:true}}); report.lineage++; }
      }
    }
  }
  if (apply) {
    await tx.delete(forkAggregates).where(eq(forkAggregates.sourceTargetType,"PRIMITIVE"));
    await tx.execute(sql`INSERT INTO fork_aggregates (source_target_type,source_target_id,source_version_id,fork_count,updated_at) SELECT source_target_type,source_target_id,source_version_id,count(*)::int,now() FROM forks WHERE source_target_type='PRIMITIVE' GROUP BY source_target_type,source_target_id,source_version_id`);
  }
}

async function main(){
  if (apply) await db.transaction(async tx=>migrate(tx as typeof db)); else await migrate(db);
  console.log(JSON.stringify({mode:apply?"APPLY":"DRY_RUN",...report},null,2));
  await pool.end();
}
main().catch(async error=>{console.error(error);try{await pool.end();}catch{}process.exit(1);});
