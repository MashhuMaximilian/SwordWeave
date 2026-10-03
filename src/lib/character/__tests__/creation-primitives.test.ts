import { describe, expect, it } from "vitest";
import { expandBundles, summarizeExpansionCost } from "@/lib/engine/bundle-expander";
import { adoptCreationPurchases, missingCreationAccess } from "../creation-primitives";

const input = () => ({ heritages: [], effects: [], primitives: [{ primitiveId: 1, source: "PERSONAL" as const, isMirrored: false }], capabilities: [{ id: "new-capability", source: "MANIFEST" as const, primitiveLinks: [{ primitiveId: 1 }, { primitiveId: 2 }], effectLinks: [{ effectId: "same-rule-effect", primitiveLinks: [{ primitiveId: 1 }] }] }] });
describe("creation owned primitive accounting", () => {
  it("charges 30 BU for a 40 BU capability when its 10 BU rule is already owned", () => {
    const expansion = adoptCreationPurchases(expandBundles(input()));
    const costs = new Map([[1, 10], [2, 30]]);
    expect(summarizeExpansionCost(expansion, costs, new Map()).positiveCost - 10).toBe(30);
    expect(expansion.primitives.filter(p => p.primitiveId === 1)).toHaveLength(1);
    expect(expansion.primitives.find(p => p.primitiveId === 1)).toMatchObject({ originCapabilityId: "new-capability", directSource: "PERSONAL" });
  });
  it("retains deliberately purchased additional copies and an independently mirrored occurrence", () => {
    const selected = input();
    selected.primitives.push({ primitiveId: 1, source: "PERSONAL", isMirrored: false }, { primitiveId: 1, source: "PERSONAL", isMirrored: true });
    const expansion = adoptCreationPurchases(expandBundles(selected));
    expect(expansion.primitives.filter(p => p.primitiveId === 1)).toHaveLength(3);
    expect(summarizeExpansionCost(expansion, new Map([[1, 10], [2, 30]]), new Map([[1, 4]]))).toMatchObject({ positiveCost: 50, mirrorCredit: 4 });
  });
  it("requires positive verb and domain access, including when supplied by a composition", () => {
    const expansion = adoptCreationPurchases(expandBundles(input()));
    const definitions = [{ id: 1, category: "DOMAIN" }, { id: 2, category: "VERB_TIER" }];
    expect(missingCreationAccess(expansion, definitions)).toEqual([]);
    expect(missingCreationAccess({ ...expansion, primitives: expansion.primitives.map(p => ({ ...p, isMirrored: true })) }, definitions)).toEqual(["verb tier", "domain"]);
  });
});
