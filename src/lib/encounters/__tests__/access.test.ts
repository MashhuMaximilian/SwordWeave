import { describe, it, expect } from "vitest";
import { sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import {
  audienceIncludes,
  directVisibilityCondition,
  sharePreparation,
} from "../access";
import { encounterDefinitionSchema } from "../model";
describe("encounter preparation privacy", () => {
  it("defaults old drafts to private and rejects unsupported visibility", () => {
    expect(encounterDefinitionSchema.parse({ name: "Bridge" }).visibility).toBe(
      "PRIVATE",
    );
    expect(
      encounterDefinitionSchema.safeParse({
        name: "Bridge",
        visibility: "ROLE_GM",
      }).success,
    ).toBe(false);
  });
  it("never publishes private or another author's follower-only template to a broader audience", () => {
    for (const sourceVisibility of [
      "PUBLIC",
      "FOLLOWERS_ONLY",
      "PRIVATE",
    ] as const) {
      expect(
        audienceIncludes("PUBLIC", "author", {
          userId: "author",
          visibility: sourceVisibility,
        }),
      ).toBe(sourceVisibility === "PUBLIC");
      expect(
        audienceIncludes("FOLLOWERS_ONLY", "author", {
          userId: "author",
          visibility: sourceVisibility,
        }),
      ).toBe(sourceVisibility !== "PRIVATE");
      expect(
        audienceIncludes("FOLLOWERS_ONLY", "author", {
          userId: "other",
          visibility: sourceVisibility,
        }),
      ).toBe(sourceVisibility === "PUBLIC");
      expect(
        audienceIncludes("PRIVATE", "author", {
          userId: "other",
          visibility: sourceVisibility,
        }),
      ).toBe(true);
    }
  });
  it("shared preparation removes character identities while retaining explicit budgets", () => {
    const original = {
      characterIds: ["private-sheet"],
      budgetSource: "characters",
      partyBu: 50,
      partyItemBu: 9,
      name: "Scene",
    };
    expect(sharePreparation(original)).toEqual({
      ...original,
      characterIds: [],
      budgetSource: "manual",
    });
    expect(original.characterIds).toEqual(["private-sheet"]);
  });
  it("uses Clerk identities for owners and joins internal IDs only for follows", () => {
    const query = new PgDialect().sqlToQuery(
      directVisibilityCondition(sql`e.owner_id`, sql`e.visibility`, "viewer"),
    );
    expect(query.sql).toContain("e.owner_id=");
    expect(query.params).toContain("viewer");
    expect(query.sql).toContain("a.clerk_user_id=e.owner_id");
    expect(query.sql).toContain("v.clerk_user_id=");
    expect(query.sql).toContain("f.following_id");
    expect(query.sql).toContain("FOLLOWERS_ONLY");
  });
});
