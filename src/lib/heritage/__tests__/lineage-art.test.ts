import { describe, expect, it } from "vitest";
import { curatedLineageArt, lineageArtUrl } from "../lineage-art";
describe("curated lineage presentation art", () => {
  it("maps thirty distinct exact curated identities", () => {
    expect(curatedLineageArt).toHaveLength(30);
    expect(new Set(curatedLineageArt.map(x => x.imageUrl)).size).toBe(30);
    for (const art of curatedLineageArt) expect(lineageArtUrl({...art, kind:"LINEAGE",imageUrl:null})).toBe(art.imageUrl);
  });
  it("preserves explicit artwork", () => {
    expect(lineageArtUrl({kind:"MANIFEST", imageUrl:" https://example.com/custom.webp "})).toBe("https://example.com/custom.webp");
  });
  it("never guesses art from names or unrelated system/user origins", () => {
    const art=curatedLineageArt.find(x=>x.name==="Ashlung")!;
    expect(lineageArtUrl({...art, imageUrl:null,kind:"MANIFEST"})).toBeNull();
    expect(lineageArtUrl({name:art.name,kind:"LINEAGE",sourceOrigin:"system"})).toBeNull();
    expect(lineageArtUrl({name:art.name,kind:"LINEAGE",sourceOrigin:"user:fork"})).toBeNull();
    expect(lineageArtUrl({...art,name:"Human (fork)",imageUrl:null,kind:"LINEAGE"})).toBeNull();
  });
});
