import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  draftV1,
  preparePinnedCharacterCreation,
  previewCharacter,
  type DraftV1,
} from "../proposal";

const { select, query } = vi.hoisted(() => ({ select: vi.fn(), query: vi.fn() }));
vi.mock("@/db/client", () => ({
  db: { select: (fields: unknown) => select(fields) },
}));

const actor = { id: "fictional-player", clerkId: "user_fictional" };
const pin = (id: number, rev = 1) => ({
  kind: "primitive" as const,
  id: String(id),
  versionId: `f0000000-0000-4000-8000-${String(id * 10 + rev).padStart(12, "0")}`,
});

function definition(id: number, category: string, name: string, buCost: number, freeFoundation = false, mirrorBuCredit = 0) {
  const hardModifiers = mirrorBuCredit ? [{ kind: "modify", operation: "add", target: "defense_dc", value: 2 }] : [];
  return {
    id, category, name, buCost, freeFoundation, mirrorBuCredit, versionId: pin(id).versionId,
    isMirrorable: mirrorBuCredit > 0, hardModifiers, userId: null, sourceOrigin: "SRD",
    snapshot: { name, category, buCost, hardModifiers, ...(mirrorBuCredit ? { mirrorVector: "VARIABLE_VECTOR" } : {}) },
  };
}

const range = definition(32, "RANGE", "Touch Range", 0, true);
const minor = definition(19, "INTENSITY_DICE", "Minor Die Block (d4)", 0, true);
const verb = definition(3, "VERB_TIER", "Verb Tier III", 8);
const domain = definition(2, "DOMAIN", "Storm", 4);
const heavy = definition(4, "INTENSITY_DICE", "Heavy Die Block (d8)", 4);
const dieCount = definition(5, "OUTPUT", "Extra output die", 2);
const drawback = definition(6, "SHEET_AUGMENT", "Fragile stance", 2, false, 2);

function draft(components = [verb, domain]): DraftV1 {
  return {
    schemaVersion: 1,
    name: "  Fenn  ",
    attributes: { physical: 4, mental: 3, magical: 3 },
    pieces: components.map(component => ({ key: `p${component.id}`, action: "reuse", pin: pin(component.id) })),
    placements: components.map(component => ({ pieceKey: `p${component.id}`, source: "PERSONAL" })),
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  select.mockImplementation(() => ({
    from: () => ({ innerJoin: () => ({ where: (condition: unknown) => ({ orderBy: () => query(condition) }) }) }),
  }));
  query.mockResolvedValue([verb, domain, range, { ...minor, name: "Minor Die Block" }, heavy, dieCount, drawback]);
});

describe("read-only starter character preview", () => {
  it("returns the four starting choices and the website character defaults for an empty draft", async () => {
    const result = await previewCharacter({ schemaVersion: 1 }, actor);
    expect(result.missing).toEqual(["name", "startingAccess.verbTier", "startingAccess.domain"]);
    expect(result.normalized).toMatchObject({ size: "MEDIUM", attributes: { physical: 4, mental: 3, magical: 3, proficient: "PHYSICAL" } });
    expect(result.normalized.startingAccess).toEqual({ verbTier: "missing", domain: "missing", range: "freeBaseline", dieType: "freeBaseline" });
    expect(result.normalized.placements.map(row => row.name)).toEqual(["Touch Range", "Minor Die Block"]);
    expect(result.budget).toMatchObject({ level: 1, startingBu: 25, positiveSpent: 0, mirrorCredit: 0 });
    expect(result.validationErrors).toEqual([]);

    const expression = query.mock.calls[0]?.[0];
    const sql = new PgDialect().sqlToQuery(expression).sql;
    expect(sql).toContain("visibility = 'PUBLIC'");
    expect(sql).toContain("visibility = 'FOLLOWERS_ONLY'");
    expect(sql).toContain("unpublished_at IS NULL");
    expect(sql).toContain('"primitive_versions"."snapshot"');
  });

  it("accepts a d8 size, permits repeated positive acquisitions and preserves reviewed Markdown and mirror credit", async () => {
    const input = draft([verb, domain, range, heavy, drawback]);
    input.placements = [
      ...input.placements!.slice(0, -1),
      { pieceKey: `p${domain.id}`, source: "MANIFEST" },
      { pieceKey: `p${drawback.id}`, source: "PERSONAL", isMirrored: true },
    ];
    input.backstory = { description: "**A courier**\n\n- Finds waystones  \n- Trades stories" };
    input.portraitPrompt = "A fictional portrait";
    const { preview, prepared } = await preparePinnedCharacterCreation(input, actor);
    expect(preview.validationErrors).toEqual([]);
    expect(preview.missing).toEqual([]);
    expect(preview.normalized).toMatchObject({ name: "Fenn", size: "MEDIUM", backstory: input.backstory,
      startingAccess: { verbTier: "selected", domain: "selected", range: "selected", dieType: "selected" } });
    expect(preview.normalized.placements.map(row => [row.name, row.source])).toEqual([
      [verb.name, "PERSONAL"], [domain.name, "PERSONAL"], [range.name, "PERSONAL"], [heavy.name, "PERSONAL"],
      [domain.name, "MANIFEST"], [drawback.name, "PERSONAL"],
    ]);
    expect(preview.budget).toMatchObject({ positiveSpent: 20, mirrorCredit: 2, netSpent: 18 });
    expect(prepared?.draft.backstory?.description).toEqual(input.backstory.description);
    expect(JSON.stringify({ preview, prepared })).not.toContain(input.portraitPrompt);
    expect((await preparePinnedCharacterCreation(prepared!.draft, actor)).prepared?.fingerprint).toBe(prepared?.fingerprint);
    expect((await preparePinnedCharacterCreation(input, { ...actor, id: "other" })).prepared?.fingerprint).not.toBe(prepared?.fingerprint);
  });

  it("does not substitute a dice-count modifier for a die type", async () => {
    const input = draft([verb, domain, range, dieCount]);
    query.mockResolvedValue([verb, domain, range, dieCount]);
    const { preview, prepared } = await preparePinnedCharacterCreation(input, actor);
    expect(preview.normalized.startingAccess.dieType).toBe("missing");
    expect(preview.missing).toContain("startingAccess.dieType");
    expect(prepared).toBeNull();
  });

  it("closes hidden or stale pins and unsupported authoring before approval", async () => {
    const input = draft();
    query.mockResolvedValue([{ ...verb, versionId: pin(verb.id, 2).versionId }, range, { ...minor, name: "Minor Die Block" }]);
    const { preview, prepared } = await preparePinnedCharacterCreation(input, actor);
    expect(preview.validationErrors.map(error => error.code)).toEqual(["PIN_UNAVAILABLE", "PIN_UNAVAILABLE"]);
    expect(preview.normalized.placements.map(row => row.name)).not.toContain(domain.name);
    expect(prepared).toBeNull();

    const authored = draft();
    authored.pieces!.push(
      { key: "new_storm", action: "fork", from: pin(domain.id), changes: { name: "Storm draft" } },
      { key: "new_effect", action: "create", kind: "effect", fields: { name: "Storm effect", narrativeDescription: "**Weather** gathers." } },
    );
    const fork = await preparePinnedCharacterCreation(authored, actor);
    expect(fork.preview.validationErrors).toEqual(expect.arrayContaining([
      expect.objectContaining({ pieceKey: "new_storm", code: "PIN_UNAVAILABLE" }),
      expect.objectContaining({ pieceKey: "new_effect", code: "UNSUPPORTED_PIECE" }),
    ]));
    expect(fork.prepared).toBeNull();
  });

  it("reports the table approval gap and declines an over-budget starter save", async () => {
    const input = draft([verb, domain, range, heavy]);
    input.placements!.push({ pieceKey: `p${verb.id}`, source: "PERSONAL" }, { pieceKey: `p${heavy.id}`, source: "PERSONAL" });
    const { preview, prepared } = await preparePinnedCharacterCreation(input, actor);
    expect(preview.budget).toMatchObject({ positiveSpent: 28, overflow: 3, aboveNextLevel: false });
    expect(preview.tableQuestions).toHaveLength(1);
    expect(prepared).toBeNull();
  });

  it("rejects unknown fields, invalid scores, out-of-range IDs and extra portrait storage metadata", () => {
    expect(draftV1.safeParse({ ...draft(), userId: "user_other" }).success).toBe(false);
    expect(draftV1.safeParse({ ...draft(), attributes: { physical: 9 } }).success).toBe(false);
    expect(draftV1.safeParse({ ...draft(), pieces: [{ key: "a", action: "reuse", pin: pin(2147483648) }] }).success).toBe(false);
    expect(draftV1.safeParse({ ...draft(), portraitUrl: "some external URL" }).success).toBe(false);
  });
});
