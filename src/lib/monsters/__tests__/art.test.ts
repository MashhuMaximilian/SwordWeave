import {describe,it,expect} from "vitest";
import {monsterArtwork} from "../art";
describe("curated creature artwork",()=>{
 it("only supplies defaults to the named curated examples",()=>{
  expect(monsterArtwork({name:"Cinderwing Courier",sourceOrigin:"Monster feedback examples · October 2026"})).toBe("/art/monsters/cinderwing-courier-graphic-v1.webp");
  expect(monsterArtwork({name:"Cinderwing Courier",sourceOrigin:"My world"})).toBeNull();
  expect(monsterArtwork({name:"An unrelated monster",sourceOrigin:"Monster feedback examples · October 2026"})).toBeNull();
 });
 it("preserves authored artwork",()=>expect(monsterArtwork({name:"Cinderwing Courier",imageUrl:"https://example.com/my-creature.webp",sourceOrigin:"Monster feedback examples · October 2026"})).toBe("https://example.com/my-creature.webp"));
 it("does not restore a portrait the author explicitly removed",()=>expect(monsterArtwork({name:"Cinderwing Courier",imageUrl:"",sourceOrigin:"Monster feedback examples · October 2026"})).toBeNull());
});
