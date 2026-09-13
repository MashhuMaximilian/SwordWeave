import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
vi.mock("@/components/preview/entity-preview", () => ({ FetchedEntityPreview: () => null }));
import { RecipeComposition } from "../recipe-composition";

describe("heritage capability recipe", () => {
  it("retains direct and effect-granted rules in their source groups", () => {
    const html = renderToStaticMarkup(createElement(RecipeComposition, {
      id:"capability",
      primitiveLinks:[{primitiveId:1,quantity:2,primitive:{id:1,name:"Focused Edge",buCost:3,mechanicalOutputText:"Add 3 Awareness."}}],
      effectLinks:[{effectId:"effect",effect:{name:"Compelled Focus",primitiveLinks:[{primitiveId:2,primitive:{id:2,name:"Resonance",buCost:8,mechanicalOutputText:"Read capability trails."}}]}}],
    }));
    expect(html).toContain("Focused Edge"); expect(html).toContain("Add 3 Awareness.");
    expect(html).toContain("Compelled Focus"); expect(html).toContain("Read capability trails.");
    expect(html).toContain("× 2"); expect(html).toContain("Full capability details");
  });
  it("offers complete details when an embedded author receives only an ID", () => {
    expect(renderToStaticMarkup(createElement(RecipeComposition,{id:"capability"}))).toContain("Full capability details");
  });
});
