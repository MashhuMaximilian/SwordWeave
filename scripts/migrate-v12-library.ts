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
    const text=renderMechanicalRule(rule);
    const namedCandidates=await tx.select().from(primitives).where(and(eq(primitives.name,binding.name),sql`${primitives.category}::text=${template.category}`)).limit(20);
    const existing=(await tx.select().from(primitives).where(eq(primitives.sourceOrigin,sourceOrigin)).limit(1))[0]
      ?? namedCandidates.find(row=>row.userId===null || adminClerkIds.includes(row.userId ?? ""));
    let row=existing;
    let changed=false;
    if (apply) {
      if (existing) {
        changed=existing.mechanicalOutputText!==text || existing.templatePrimitiveId!==templateId || existing.narrativeRule!==template.verboseDescription;
        [row]=await tx.update(primitives).set({name:binding.name,isPublic:true,definitionKind:"EXPRESSION",templatePrimitiveId:templateId,bindingSchema:{},bindings:binding.bindings,mechanicalRule:rule as Record<string,unknown>,mechanicalTemplateText:"",mechanicalOutputText:text,narrativeRule:template.verboseDescription,hardModifiers:hardModifierFor(template.key,binding.bindings),sourceOrigin,updatedAt:new Date()}).where(eq(primitives.id,existing.id)).returning();
      } else {
        [row]=await tx.insert(primitives).values({name:binding.name,userId:null,isPublic:true,category:template.category as typeof primitives.$inferInsert.category,costTier:`Tier ${template.tier ?? 1}`,buCost:template.buCost,definitionKind:"EXPRESSION",templatePrimitiveId:templateId,bindingSchema:{},bindings:binding.bindings,mechanicalRule:rule as Record<string,unknown>,mechanicalOutputText:text,narrativeRule:template.verboseDescription,hardModifiers:hardModifierFor(template.key,binding.bindings),sourceOrigin}).returning();
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
      const mechanicalRule=expression.mechanicalText ? {family:"DOCUMENTED" as const,text:expression.mechanicalText} : {family:"DESCRIPTIVE" as const};
      const values={name:expression.name,isPublic:true,definitionKind:"EXPRESSION" as const,templatePrimitiveId:null,bindingSchema:{},bindings:{},mechanicalRule,mechanicalTemplateText:"",mechanicalOutputText:expression.mechanicalText,narrativeRule:expression.verboseDescription,hardModifiers:expression.modifier ? [expression.modifier] : [],sourceOrigin,updatedAt:new Date()};
      let row; let changed=true;
      if(existing){ changed=existing.mechanicalOutputText!==values.mechanicalOutputText || existing.narrativeRule!==expression.verboseDescription || existing.definitionKind!=="EXPRESSION" || !isDeepStrictEqual(existing.mechanicalRule,mechanicalRule); [row]=await tx.update(primitives).set(values).where(eq(primitives.id,existing.id)).returning(); }
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
    const modifierText=mechanicalDescriptionFromModifiers((row.hardModifiers ?? []) as HardModifier[]);
    if (isSystem && modifierText) {
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
      JSON.stringify(row.bindings)!==JSON.stringify(bindings) || (mechanicalText && row.mechanicalOutputText!==mechanicalText)
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
