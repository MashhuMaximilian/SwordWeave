import { describe, expect, it } from "vitest";
import { curatedLineageArt, curatedHeritageRoleArt, lineageArtUrl, libraryHeritageArt } from "../lineage-art";
describe("curated lineage presentation art", () => {
  it("maps thirty distinct exact curated identities", () => {
    expect(curatedLineageArt).toHaveLength(30);
    expect(new Set(curatedLineageArt.map(x => x.imageUrl)).size).toBe(30);
    for (const art of curatedLineageArt) expect(lineageArtUrl({...art, kind:"LINEAGE",imageUrl:null})).toBe(art.imageUrl);
  });
  it("maps every curated role portrait after SRD promotion without crossing kinds", () => {
    expect(curatedHeritageRoleArt).toHaveLength(78);
    expect(new Set(curatedHeritageRoleArt.map(x => x.imageUrl)).size).toBe(78);
    for (const art of curatedHeritageRoleArt) {
      expect(lineageArtUrl({...art, imageUrl:null, sourceOrigin:"SRD"})).toBe(art.imageUrl);
      expect(lineageArtUrl({...art, imageUrl:null, sourceOrigin:"user:fork"})).toBeNull();
      expect(lineageArtUrl({...art, imageUrl:null, kind:"LINEAGE", sourceOrigin:"SRD"})).toBeNull();
    }
  });
  it("preserves explicit artwork", () => {
    expect(lineageArtUrl({kind:"MANIFEST", imageUrl:" https://example.com/custom.webp "})).toBe("https://example.com/custom.webp");
  });
  it("uses uploaded portraits without the metallic icon route", () => {
    expect(lineageArtUrl({kind:"UPBRINGING",iconSource:"UPLOAD",iconUrl:"user-uploads/person/art.webp"})).toBe("/api/icons/blob/user-uploads/person/art.webp");
    expect(lineageArtUrl({kind:"MANIFEST",iconSource:"UPLOAD",iconUrl:"https://example.com/art.webp"})).toBe("https://example.com/art.webp");
    expect(lineageArtUrl({kind:"LINEAGE",imageUrl:"/images/chosen.webp",iconSource:"UPLOAD",iconUrl:"user-uploads/other.webp"})).toBe("/images/chosen.webp");
  });
  it("passes slim library artwork only for heritage records", () => {
    expect(libraryHeritageArt({targetType:"LINEAGE_TEMPLATE",name:"Ironborn",sourceOrigin:"system"})).toBe("/images/lineages/ironborn-graphic-v1.webp");
    expect(libraryHeritageArt({targetType:"UPBRINGING_TEMPLATE",name:"Artist",sourceOrigin:null,imageUrl:"/images/chosen.webp"})).toBe("/images/chosen.webp");
    expect(libraryHeritageArt({targetType:"PRIMITIVE",name:"Ironborn",sourceOrigin:"system",imageUrl:"/images/chosen.webp"})).toBeNull();
  });
  it("never guesses art from names or unrelated system/user origins", () => {
    const art=curatedLineageArt.find(x=>x.name==="Ashlung")!;
    expect(lineageArtUrl({...art, imageUrl:null,kind:"MANIFEST"})).toBeNull();
    expect(lineageArtUrl({name:art.name,kind:"LINEAGE",sourceOrigin:"system"})).toBeNull();
    expect(lineageArtUrl({name:art.name,kind:"LINEAGE",sourceOrigin:"user:fork"})).toBeNull();
    expect(lineageArtUrl({...art,name:"Human (fork)",imageUrl:null,kind:"LINEAGE"})).toBeNull();
  });
});
