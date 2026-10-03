import { describe, it, expect } from "vitest";
import {
  quickbuildCost,
  shuffleQuickbuild,
  EMPTY_QUICKBUILD,
  type QuickbuildCatalog,
  type QuickbuildHeritage,
} from "../quickbuild";
import { creationSize } from "@/lib/heritage/lineage-size";
import {
  buildCanonicalTemplatePayload,
  hashTemplateContent,
} from "@/lib/publishing/hash-content";
const root = (
  id: string,
  kind: QuickbuildHeritage["kind"],
  ids: number[],
  extra: Partial<QuickbuildHeritage> = {},
): QuickbuildHeritage => ({
  id,
  kind,
  name: id,
  description: null,
  imageUrl: null,
  defaultSize: kind === "LINEAGE" ? "SMALL" : null,
  cost: 0,
  primitiveLinks: ids.map((primitiveId) => ({
    primitiveId,
    isMirrored: false,
  })),
  capabilityLinks: [],
  ...extra,
});
const catalog: QuickbuildCatalog = {
  heritages: [
    root("l", "LINEAGE", [1]),
    root("u", "UPBRINGING", [1, 2]),
    root("m", "MANIFEST", [], {
      capabilityLinks: [
        {
          capabilityId: "cap",
          primitiveLinks: [{ primitiveId: 3, isMirrored: false }],
          effectLinks: [
            {
              effectId: "effect",
              primitiveLinks: [{ primitiveId: 2, isMirrored: false }],
            },
          ],
        },
      ],
    }),
  ],
  primitives: [
    { id: 1, buCost: 6, mirrorBuCredit: 2 },
    { id: 2, buCost: 4, mirrorBuCredit: 4 },
    { id: 3, buCost: 8, mirrorBuCredit: 4 },
  ],
};
const all = { LINEAGE: "l", UPBRINGING: "u", MANIFEST: "m" };
describe("Quickbuild bundle accounting and size", () => {
  it("prices shared heritage/capability/effect rules once", () => {
    expect(quickbuildCost(catalog, all)).toMatchObject({
      positiveCost: 18,
      netCost: 18,
      primitiveCount: 3,
      size: "SMALL",
    });
  });
  it("retains a separately purchased occurrence", () => {
    expect(quickbuildCost(catalog, all, [1])).toMatchObject({
      positiveCost: 24,
      primitiveCount: 4,
    });
  });
  it("keeps a direct mirrored occurrence separate from inherited paid rules", () => {
    expect(quickbuildCost(catalog, all, [], [2])).toMatchObject({
      positiveCost: 18,
      mirrorCredit: 4,
      netCost: 14,
    });
  });
  it("permits no heritage or only an upbringing", () => {
    expect(quickbuildCost(catalog, EMPTY_QUICKBUILD)).toMatchObject({
      netCost: 0,
      size: "MEDIUM",
    });
    expect(
      quickbuildCost(catalog, { ...EMPTY_QUICKBUILD, UPBRINGING: "u" }),
    ).toMatchObject({ netCost: 10, size: "MEDIUM" });
  });
  it("does not accept a manifest id in the lineage slot", () => {
    expect(
      quickbuildCost(catalog, { ...EMPTY_QUICKBUILD, LINEAGE: "m" }).selected,
    ).toEqual([]);
  });
  it("shuffles a complete affordable trio when possible", () => {
    expect(
      shuffleQuickbuild(
        catalog,
        25,
        EMPTY_QUICKBUILD,
        [],
        [],
        undefined,
        () => 0.5,
      ),
    ).toEqual(all);
  });
  it("does not overspend when only a partial build fits", () => {
    const pick = shuffleQuickbuild(
      catalog,
      6,
      EMPTY_QUICKBUILD,
      [],
      [],
      undefined,
      () => 0.5,
    );
    expect(quickbuildCost(catalog, pick).netCost).toBeLessThanOrEqual(6);
  });
  it("single-kind shuffle preserves other roots and direct spending", () => {
    const pick = shuffleQuickbuild(
      catalog,
      20,
      { ...all, LINEAGE: "" },
      [2],
      [],
      "LINEAGE",
      () => 0,
    );
    expect(pick.UPBRINGING).toBe("u");
    expect(pick.MANIFEST).toBe("m");
    expect(pick.LINEAGE).toBe("");
  });
  it("counts optional packages and weaknesses when shuffling", () => {
    const pick = shuffleQuickbuild(
      catalog,
      20,
      EMPTY_QUICKBUILD,
      [1],
      [2],
      undefined,
      () => 0,
      4,
    );
    expect(quickbuildCost(catalog, pick, [1], [2])).toMatchObject({
      netCost: 20,
      mirrorCredit: 4,
    });
  });
  it("excludes bundles that exceed the mirror debt ceiling", () => {
    const debt: QuickbuildCatalog = {
      ...catalog,
      heritages: [
        root("debt", "LINEAGE", [1], {
          primitiveLinks: [
            { primitiveId: 2, isMirrored: true },
            { primitiveId: 3, isMirrored: true },
          ],
        }),
      ],
    };
    expect(
      shuffleQuickbuild(
        debt,
        25,
        EMPTY_QUICKBUILD,
        [],
        [],
        undefined,
        () => 0,
        4,
      ).LINEAGE,
    ).toBe("");
  });
  it("Quickbuild uses lineage size even if a caller supplies another size", () => {
    expect(creationSize("quick", "HUGE", "SMALL")).toBe("SMALL");
    expect(creationSize("quick", "HUGE", null)).toBe("MEDIUM");
  });
  it("complete creation preserves an explicit size", () => {
    expect(creationSize("complete", "LARGE", "SMALL")).toBe("LARGE");
    expect(creationSize("complete", null, "SMALL")).toBe("SMALL");
  });
  it("versions a lineage size change while preserving legacy hashes", async () => {
    const base = {
      kind: "LINEAGE",
      name: "Example",
      description: "",
      suggestedTraits: "",
      isPublic: true,
      primitiveIds: [],
      capabilityIds: [],
    };
    const legacy = buildCanonicalTemplatePayload(base);
    expect(legacy).not.toHaveProperty("defaultSize");
    expect(await hashTemplateContent(legacy)).toBe(
      await hashTemplateContent(
        buildCanonicalTemplatePayload({ ...base, defaultSize: null }),
      ),
    );
    expect(
      await hashTemplateContent(
        buildCanonicalTemplatePayload({ ...base, defaultSize: "SMALL" }),
      ),
    ).not.toBe(
      await hashTemplateContent(
        buildCanonicalTemplatePayload({ ...base, defaultSize: "MEDIUM" }),
      ),
    );
    expect(
      buildCanonicalTemplatePayload({
        ...base,
        kind: "MANIFEST",
        defaultSize: "SMALL",
      }),
    ).not.toHaveProperty("defaultSize");
  });
});
