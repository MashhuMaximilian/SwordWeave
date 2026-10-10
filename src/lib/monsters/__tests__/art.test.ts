import {describe,it,expect} from "vitest";
import {monsterArtwork} from "../art";
import {systemBestiary} from "../catalogue/system-bestiary";
import {systemBestiaryArtwork} from "../catalogue/system-bestiary-art";
describe("curated creature artwork",()=>{
 it("only supplies defaults to the named curated examples",()=>{
  expect(monsterArtwork({name:"Cinderwing Courier",sourceOrigin:"Monster feedback examples · October 2026"})).toBe("/art/monsters/cinderwing-courier-graphic-v1.webp");
  expect(monsterArtwork({name:"Cinderwing Courier",sourceOrigin:"My world"})).toBeNull();
  expect(monsterArtwork({name:"An unrelated monster",sourceOrigin:"Monster feedback examples · October 2026"})).toBeNull();
 });
 it("preserves authored artwork",()=>expect(monsterArtwork({name:"Cinderwing Courier",imageUrl:"https://example.com/my-creature.webp",sourceOrigin:"Monster feedback examples · October 2026"})).toBe("https://example.com/my-creature.webp"));
 it("does not restore a portrait the author explicitly removed",()=>expect(monsterArtwork({name:"Cinderwing Courier",imageUrl:"",sourceOrigin:"Monster feedback examples · October 2026"})).toBeNull());
 it("covers all 100 system templates with distinct portraits",()=>{
  expect(systemBestiaryArtwork).toHaveLength(100);
  expect(new Set(systemBestiaryArtwork.map(row=>row.id)).size).toBe(100);
  expect(new Set(systemBestiaryArtwork.map(row=>row.path)).size).toBe(100);
  expect(systemBestiaryArtwork.map(row=>row.name)).toEqual(systemBestiary.map(row=>row.name));
  for(const row of systemBestiaryArtwork)expect(monsterArtwork({id:row.id,name:row.name})).toBe(row.path);
 });
 it("recognizes pinned system definitions without changing their snapshots",()=>{
  for(const recipe of systemBestiary){
   const definition={name:recipe.name,sourceOrigin:"SRD",catalogue:{environment:recipe.environment,role:recipe.role,tactics:recipe.tactics}};
   expect(monsterArtwork(definition)).toBe(`/art/monsters/${recipe.key}-graphic-v1.webp`);
   expect(monsterArtwork({...definition,imageUrl:"https://example.com/authored.webp"})).toBe("https://example.com/authored.webp");
   expect(monsterArtwork({...definition,imageUrl:""})).toBeNull();
   expect(monsterArtwork({...definition,catalogue:{...definition.catalogue,tactics:"My own creature"}})).toBeNull();
  }
 });
 it("does not attach system artwork to an unrelated creature with the same name",()=>{
  expect(monsterArtwork({name:systemBestiary[0]!.name,sourceOrigin:"SRD"})).toBeNull();
  const row=systemBestiaryArtwork[0]!;
  expect(monsterArtwork({id:row.id,name:row.name,imageUrl:""})).toBeNull();
 });
});
