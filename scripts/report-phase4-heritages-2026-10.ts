/** Refresh the human-readable saved recipe inventory from the live DB. */
import { writeFileSync } from "node:fs";
import { db, pool } from "@/db/client";
import { primitives } from "@/db/schema";
import { capabilityIdeas, effectIdeas, heritageRecipes } from "./phase4-heritage-data";

async function main(){
  const rows=await db.select({id:primitives.id,name:primitives.name,bu:primitives.buCost,origin:primitives.sourceOrigin,public:primitives.isPublic}).from(primitives);
  const byName=new Map(rows.filter(x=>x.public).map(x=>[x.name,x]));
  for(const [name,id] of [["Broad Familiarity",22393],["Focused Presence (Global DC Modifier)",22391],["Verb Access Tier I",20]] as const){
    const row=rows.find(x=>x.id===id);if(!row||row.name!==name)throw new Error(`Canonical row changed: ${name}`);byName.set(name,row);
  }
  const lines=[
    "# Saved heritage recipes — October 2026",
    "",
    "This inventory records the 24 lineages, 48 upbringings, and 18 manifests saved in the public SwordWeave library. Every listed BU figure is the sum of distinct linked primitives across the heritage, its capabilities, and their effects. Heritage, capability, and effect containers add 0 BU. The 25 BU creation package is separate; these are character-sheet choices across several budgets.",
    "",
    "The concept and expansion targets are in [the top-down design](./phase4-heritage-top-down-2026-10.md). The exact maintained recipe definitions are in [the data source](../../scripts/phase4-heritage-data.ts). Costs are author-selected, so a player can fork and price a variant differently.",
    "",
    "The numeric effects on the sheet are verified by the post-save audit. Descriptive permissions are judged from their card text at the table. Healing output still needs a manual Vitality adjustment; typed resistance is not applied automatically by an untyped manual Vitality edit. Doorway Brace's +2 Physical save applies only while that capability is active; the player should turn it off when the stance ends.",
    "",
    "The public DB also contains an older user-authored Ironborn test fork and one QA manifest. They are outside these 90 recipes and were left untouched.",
    "",
  ];
  for(const kind of ["LINEAGE","UPBRINGING","MANIFEST"] as const){
    lines.push(`## ${kind==="LINEAGE"?"Lineages":kind==="UPBRINGING"?"Upbringings":"Manifests"}`,"","| Name | Direct primitives | Capabilities | Distinct BU |","| --- | --- | --- | ---: |");
    for(const r of heritageRecipes.filter(x=>x.kind===kind)){
      const all=new Set(r.primitives);
      for(const name of r.capabilities){
        const cap=capabilityIdeas.find(x=>x.name===name);if(!cap)throw new Error(`Missing capability ${name}`);
        for(const p of cap.primitives)all.add(p);
        for(const effectName of cap.effects??[]){
          const effect=effectIdeas.find(x=>x.name===effectName);if(!effect)throw new Error(`Missing effect ${effectName}`);
          for(const p of effect.primitives)all.add(p);
        }
      }
      let cost=0;
      for(const name of all){const p=byName.get(name);if(!p)throw new Error(`Missing primitive ${name}`);cost+=p.bu;}
      lines.push(`| ${r.name} | ${r.primitives.join(", ")||"—"} | ${r.capabilities.join(", ")||"—"} | ${cost} |`);
    }
    lines.push("");
  }
  lines.push("## Verification","","Run `npx tsx scripts/audit-phase4-heritages-2026-10.ts` to check links, versions, publications, fork maps, capability BU metadata, bundle expansion, and representative character-sheet totals. The save script defaults to a dry run and only writes with `--apply`.","");
  const path="docs/library/phase4-heritage-recipes-saved-2026-10.md";
  writeFileSync(path,lines.join("\n"));
  console.log(`${path}: ${heritageRecipes.length} saved recipes`);
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await pool.end()});
