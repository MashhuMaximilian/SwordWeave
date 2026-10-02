/** Read-only post-save integrity and resolver smoke checks for the heritage shelf. */
import { and, eq } from "drizzle-orm";
import { db, pool } from "@/db/client";
import {
  capabilities, capabilityEffects, capabilityPrimitives, capabilityVersions,
  characterPrimitives, characters, effectPrimitives, effects, effectVersions,
  forks, heritage, heritageCapabilities, heritagePrimitives, heritageVersions,
  primitiveMarketClassifications, primitives, primitiveVersions, publications,
} from "@/db/schema";
import { resolveModifiers, type ResolvedPrimitiveSlot } from "@/lib/engine/resolve-modifiers";
import { expandBundles } from "@/lib/engine/bundle-expander";
import { aggregateCharacterSheet } from "@/lib/engine/sheet";
import { capabilityIdeas, effectIdeas, heritageRecipes, permissions } from "./phase4-heritage-data";

const prefix="system:v13:heritage-shelf:";
function assert(ok:unknown,message:string): asserts ok {if(!ok)throw new Error(message)}
const same=(a:unknown[],b:unknown[])=>a.length===b.length&&a.every((x,i)=>x===b[i]);
const sorted=<T extends string|number>(x:T[])=>[...x].sort((a,b)=>String(a).localeCompare(String(b)));

async function main(){
  const [pRows,eRows,cRows,hRows,eLinks,cLinks,ceLinks,hpLinks,hcLinks,pVersions,eVersions,cVersions,hVersions,pubs,edges,classes]=await Promise.all([
    db.select().from(primitives), db.select().from(effects),db.select().from(capabilities),db.select().from(heritage),
    db.select().from(effectPrimitives),db.select().from(capabilityPrimitives),
    db.select().from(capabilityEffects),db.select().from(heritagePrimitives),db.select().from(heritageCapabilities),
    db.select().from(primitiveVersions),db.select().from(effectVersions),db.select().from(capabilityVersions),db.select().from(heritageVersions),
    db.select().from(publications),db.select().from(forks),db.select().from(primitiveMarketClassifications),
  ]);
  const pById=new Map(pRows.map(x=>[x.id,x]));
  const eById=new Map(eRows.map(x=>[x.id,x]));
  const cById=new Map(cRows.map(x=>[x.id,x]));
  const hByKey=new Map(hRows.filter(x=>x.isPublic&&x.userId===null).map(x=>[`${x.kind}:${x.name}`,x]));
  const pByName=new Map(pRows.filter(x=>x.isPublic).map(x=>[x.name,x]));
  for(const [name,id] of [["Broad Familiarity",22393],["Focused Presence (Global DC Modifier)",22391],["Verb Access Tier I",20]] as const)pByName.set(name,pById.get(id)!);
  const published=(type:string,id:string)=>pubs.some(x=>x.targetType===type&&x.targetId===id&&x.visibility==="PUBLIC"&&!x.unpublishedAt);
  const latest=(rows:{isLatest:boolean}[],name:string)=>assert(rows.filter(x=>x.isLatest).length===1,`Latest version count ${name}`);
  for(const idea of permissions){
    const row=pRows.find(x=>x.name===idea.name&&x.sourceOrigin?.startsWith(`${prefix}permission:`));
    assert(row,`Missing permission ${idea.name}`);
    assert(row.buCost===idea.bu&&row.isPublic&&!row.isMirrorable&&row.hardModifiers.length===0,`Permission drift ${idea.name}`);
    assert(published("PRIMITIVE",String(row.id)),`Not published ${idea.name}`);
    latest(pVersions.filter(x=>x.primitiveId===row.id),idea.name);
    assert(edges.some(x=>x.forkedTargetType==="PRIMITIVE"&&x.forkedTargetId===String(row.id)),`No fork ${idea.name}`);
    assert(classes.some(x=>x.primitiveId===row.id),`No family ${idea.name}`);
  }
  const eByName=new Map<string,typeof eRows[number]>();
  for(const idea of effectIdeas){
    const row=eRows.find(x=>x.name===idea.name&&x.sourceOrigin?.startsWith(`${prefix}effect:`));assert(row,`Missing effect ${idea.name}`);
    assert(published("EFFECT",row.id),`Not published effect ${idea.name}`);
    latest(eVersions.filter(x=>x.effectId===row.id),idea.name);
    const actual=sorted(eLinks.filter(x=>x.effectId===row.id).map(x=>pById.get(x.primitiveId)?.name??""));
    assert(same(actual,sorted(idea.primitives)),`Effect links differ ${idea.name}: ${actual}`);
    eByName.set(idea.name,row);
  }
  const cByName=new Map<string,typeof cRows[number]>();
  for(const idea of capabilityIdeas){
    const row=cRows.find(x=>x.name===idea.name&&x.sourceOrigin?.startsWith(`${prefix}capability:`));assert(row,`Missing capability ${idea.name}`);
    assert(published("CAPABILITY",row.id),`Not published capability ${idea.name}`);
    latest(cVersions.filter(x=>x.capabilityId===row.id),idea.name);
    const actual=sorted(cLinks.filter(x=>x.capabilityId===row.id).map(x=>pById.get(x.primitiveId)?.name??""));
    assert(same(actual,sorted(idea.primitives)),`Capability links differ ${idea.name}: ${actual}`);
    const effectNames=sorted(ceLinks.filter(x=>x.capabilityId===row.id).map(x=>eById.get(x.effectId)?.name??""));
    assert(same(effectNames,sorted(idea.effects??[])),`Capability effect links differ ${idea.name}`);
    const full=new Set(cLinks.filter(x=>x.capabilityId===row.id).map(x=>x.primitiveId));
    for(const link of ceLinks.filter(x=>x.capabilityId===row.id))for(const ep of eLinks.filter(x=>x.effectId===link.effectId))full.add(ep.primitiveId);
    const price=[...full].reduce((sum,id)=>sum+pById.get(id)!.buCost,0);
    assert(row.metadata?.totalBu===price,`Capability BU metadata differs ${idea.name}: ${row.metadata?.totalBu} vs ${price}`);
    cByName.set(idea.name,row);
  }
  const prices:number[]=[];
  for(const recipe of heritageRecipes){
    const row=hByKey.get(`${recipe.kind}:${recipe.name}`);assert(row,`Missing heritage ${recipe.name}`);
    assert(published(`${recipe.kind}_TEMPLATE`,row.id),`Not published heritage ${recipe.name}`);
    latest(hVersions.filter(x=>x.templateId===row.id),recipe.name);
    const direct=sorted(hpLinks.filter(x=>x.templateId===row.id).map(x=>pById.get(x.primitiveId)?.name??""));
    assert(same(direct,sorted(recipe.primitives)),`Heritage primitive links differ ${recipe.name}: ${direct}`);
    const caps=sorted(hcLinks.filter(x=>x.templateId===row.id).map(x=>cById.get(x.capabilityId)?.name??""));
    assert(same(caps,sorted(recipe.capabilities)),`Heritage capabilities differ ${recipe.name}: ${caps}`);
    const full=new Set(hpLinks.filter(x=>x.templateId===row.id).map(x=>x.primitiveId));
    for(const capName of recipe.capabilities){
      const cap=cByName.get(capName)!;
      for(const x of cLinks.filter(x=>x.capabilityId===cap.id))full.add(x.primitiveId);
      for(const ce of ceLinks.filter(x=>x.capabilityId===cap.id))for(const ep of eLinks.filter(x=>x.effectId===ce.effectId))full.add(ep.primitiveId);
    }
    const cost=[...full].reduce((sum,id)=>sum+pById.get(id)!.buCost,0);
    assert(row.description?.includes(`${cost} BU`),`Cost/description drift ${recipe.name}: ${cost}`);
    prices.push(cost);
  }
  // Use the same expander that the character workshop uses, then feed the
  // resulting saved primitive records into the actual sheet resolver.
  const guardian=hByKey.get("MANIFEST:Guardian")!;
  const guardianCaps=hcLinks.filter(x=>x.templateId===guardian.id).map(link=>({capabilityId:link.capabilityId,
    primitiveLinks:cLinks.filter(x=>x.capabilityId===link.capabilityId).map(x=>({primitiveId:x.primitiveId})),
    effectLinks:ceLinks.filter(x=>x.capabilityId===link.capabilityId).map(ce=>({effectId:ce.effectId,
      primitiveLinks:eLinks.filter(x=>x.effectId===ce.effectId).map(x=>({primitiveId:x.primitiveId}))}))}));
  const expansion=expandBundles({heritages:[{id:guardian.id,kind:"MANIFEST",primitiveLinks:hpLinks.filter(x=>x.templateId===guardian.id).map(x=>({primitiveId:x.primitiveId})),capabilityLinks:guardianCaps}],capabilities:[],effects:[],primitives:[]});
  assert(expansion.warnings.length===0,"Guardian expansion warnings");
  const slots:ResolvedPrimitiveSlot[]=expansion.primitives.map(x=>{
    const row=pById.get(x.primitiveId)!;
    return {primitiveId:row.id,name:row.name,category:row.category,hardModifiers:row.hardModifiers,
      isMirrored:x.isMirrored,isMirrorable:row.isMirrorable,mirrorVector:row.mirrorVector,
      originHeritageId:x.originHeritageId,originCapabilityId:x.originCapabilityId,originEffectId:x.originEffectId};
  });
  const context={character:{vitality:20,vitalityMax:20,saveDc:10,blockValue:0,
    attributes:{physical:3,mental:2,magical:1},practices:{} as never,proficiencies:new Set(["physical"]),flags:new Set<string>(),custom:{}}};
  const input={characterId:"phase4-audit",level:5,pb:3,attributes:context.character.attributes,proficientAttribute:"physical" as const,chosenAttribute:"physical" as const,conditionContext:context,slots};
  const baseline=resolveModifiers({...input,slots:[]}).totals;
  const active=resolveModifiers(input).totals;
  assert(active.save_dc===baseline.save_dc+1,`Guardian DC ${active.save_dc} vs ${baseline.save_dc}`);
  assert(active.physical_saving_throw===baseline.physical_saving_throw+2,`Guardian Physical save ${active.physical_saving_throw}`);
  assert(active.mental_saving_throw===baseline.mental_saving_throw,"Guardian altered Mental save");
  const capSave=slots.find(x=>x.name==="Physical Saving Throw +2")!;
  const mirrored=resolveModifiers({...input,slots:[{...capSave,isMirrored:true}]}).totals;
  const inactive=resolveModifiers({...input,slots:[{...capSave,isToggledOff:true}]}).totals;
  assert(mirrored.physical_saving_throw===baseline.physical_saving_throw-2,"Mirror failed");
  assert(inactive.physical_saving_throw===baseline.physical_saving_throw,"Inactive failed");
  const sheetInput={characterId:"phase4-sheet",level:5,attrPhysical:3,attrMental:2,attrMagical:1,
    attrProficient:"PHYSICAL" as const,practiceSlices:null,startingBu:100,buSpent:0,dmBonusBu:0,
    currentVitality:null,size:"MEDIUM" as const,capabilityLinks:[],itemLinks:[],runtimeConditions:[]};
  const makeSheet=(names:string[])=>aggregateCharacterSheet({...sheetInput,primitiveLinks:names.map(name=>{
    const x=pByName.get(name);assert(x,`Missing sheet primitive ${name}`);
    return {primitiveId:x.id,source:"LINEAGE",acquiredAtLevel:1,isMirrored:false,
      primitive:{id:x.id,name:x.name,category:x.category,buCost:x.buCost,isMirrorable:x.isMirrorable,
        mirrorBuCredit:x.mirrorBuCredit,mirrorVector:x.mirrorVector,hardModifiers:x.hardModifiers}};
  })});
  const baseSheet=makeSheet([]);
  const skySheet=makeSheet(["Aero Unlock","Flying Speed +30","Awareness Check +2","Cold Resistance","Physical Saving Throw +2","Controlled Glide"]);
  assert(skySheet.speedByType["FLYING_SPEED"]===30,`Skyborn flying speed ${skySheet.speedByType["FLYING_SPEED"]}`);
  assert(skySheet.dc===baseSheet.dc,"Skyborn unexpectedly changed DC");
  const ironSheet=makeSheet(["Retractable Carapace","Temporary Material Patch","Slashing Resistance","Piercing Resistance","Vitality Core Augment II","Carry Capacity Augment +50"]);
  assert(ironSheet.vitality.max===baseSheet.vitality.max+12,`Ironborn Vitality ${ironSheet.vitality.max}`);
  assert(ironSheet.carryCapacity===baseSheet.carryCapacity+50,`Ironborn Carry ${ironSheet.carryCapacity}`);
  const artisanSheet=makeSheet(["Finesse Proficiency","Knowledge Check +2","Reason Check +2","Equipment Slot Augment +2","Carry Capacity Augment +50"]);
  assert(artisanSheet.encumbrance.equipSlotsAvailable===baseSheet.encumbrance.equipSlotsAvailable+2,`Artificer equip slots ${artisanSheet.encumbrance.equipSlotsAvailable}`);
  const characterId="462f9048-b0da-4185-98db-d18027132c82";
  const character=await db.query.characters.findFirst({where:eq(characters.id,characterId),with:{
    primitiveLinks:{with:{primitive:true}},capabilityLinks:{with:{capability:true}},itemLinks:{with:{item:true}},
  }});
  assert(character,"Reference character missing");
  const existingSlots=await db.select({id:characterPrimitives.primitiveId}).from(characterPrimitives).where(eq(characterPrimitives.characterId,characterId));
  const referenceSheet=aggregateCharacterSheet({
    characterId,level:character.level,attrPhysical:character.attrPhysical,attrMental:character.attrMental,attrMagical:character.attrMagical,
    attrProficient:character.attrProficient,practiceSlices:character.practiceSlices as never,startingBu:character.startingBu,buSpent:character.buSpent,
    dmBonusBu:character.dmBonusBu,currentVitality:character.currentVitality,size:character.size,
    primitiveLinks:character.primitiveLinks.map(l=>({primitiveId:l.primitiveId,source:l.source,acquiredAtLevel:l.acquiredAtLevel,isMirrored:l.isMirrored,
      directSource:l.directSource,originItemId:l.originItemId,primitive:{id:l.primitive.id,name:l.primitive.name,category:l.primitive.category,
      buCost:l.primitive.buCost,isMirrorable:l.primitive.isMirrorable,mirrorBuCredit:l.primitive.mirrorBuCredit,mirrorVector:l.primitive.mirrorVector,
      hardModifiers:l.primitive.consequenceBehavior?[]:l.primitive.hardModifiers}})),
    capabilityLinks:character.capabilityLinks.map(l=>({capabilityId:l.capabilityId,acquiredAtLevel:l.acquiredAtLevel,capability:l.capability})),
    itemLinks:character.itemLinks.map(l=>({itemId:l.itemId,quantity:l.quantity,equipped:l.equipped,item:l.item})),runtimeConditions:[],
  } as never);
  console.log(JSON.stringify({status:"PASS",permissions:permissions.length,effects:effectIdeas.length,capabilities:capabilityIdeas.length,
    heritages:heritageRecipes.length,counts:{lineages:24,upbringings:48,manifests:18},bu:{min:Math.min(...prices),max:Math.max(...prices)},
    guardian:{expanded:expansion.primitives.length,baselineDc:baseline.save_dc,activeDc:active.save_dc,basePhysicalSave:baseline.physical_saving_throw,activePhysicalSave:active.physical_saving_throw},
    sheets:{skybornFlight:skySheet.speedByType["FLYING_SPEED"],ironbornVitalityDelta:ironSheet.vitality.max-baseSheet.vitality.max,
      ironbornCarryDelta:ironSheet.carryCapacity-baseSheet.carryCapacity,artificerSlotDelta:artisanSheet.encumbrance.equipSlotsAvailable-baseSheet.encumbrance.equipSlotsAvailable},
    originalCharacter:{name:character.name,level:character.level,buSpent:character.buSpent,primitiveSlots:existingSlots.length,
      load:`${referenceSheet.load}/${referenceSheet.carryCapacity}`,equip:`${referenceSheet.encumbrance.equipSlotsUsed}/${referenceSheet.encumbrance.equipSlotsAvailable}`}}));
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await pool.end()});
