import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  rows: [] as { id: string; version: number; budget: number; role: string }[],
  pin: vi.fn(),
}));
vi.mock("@/lib/encounters/http", () => ({
  encounterRequest: async (work: (owner: string) => unknown) => new Response(JSON.stringify(await work("owner-123")), { headers: { "Content-Type": "application/json" } }),
}));
vi.mock("@/lib/encounters/service", () => ({
  pinSummary: mocks.pin,
  EncounterError: class extends Error {},
}));
vi.mock("@/db/client", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({ orderBy: () => ({ limit: async () => mocks.rows }) }),
      }),
    }),
  },
}));
import { POST } from "@/app/api/encounters/groups/route";
const id = "22222222-2222-4222-8222-222222222222";
const request = (data: unknown) =>
  new Request("http://localhost/api/encounters/groups", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
beforeEach(() => {
  mocks.pin.mockReset();
  mocks.rows = [{ id, version: 4, budget: 25, role: "Support" }];
});
describe("private encounter group proposals", () => {
  it("resolves each pin for the requesting owner and appraises quantities using resolved equipment", async () => {
    mocks.pin.mockResolvedValue({
      summary: {
        templateId: id,
        version: 4,
        name: "Support",
        budget: 25,
        itemBu: 3,
        maximum: 13,
      },
    });
    const data = await (await POST(
      request({ budget: 100, count: 4, itemBudget: 12 }),
    )).json() as {
      groups: { creatureBu: number; itemBu: number; entries: unknown[] }[];
    };
    expect(data.groups).toHaveLength(1);
    expect(data.groups[0]).toMatchObject({
      creatureBu: 100,
      itemBu: 12,
      entries: [{ templateId: id, version: 4, quantity: 4 }],
    });
    expect(mocks.pin).toHaveBeenCalledTimes(1);
    expect(mocks.pin).toHaveBeenCalledWith("owner-123", id, 4);
  });
  it("rejects groups that exceed the separate equipment limit", async () => {
    mocks.pin.mockResolvedValue({
      summary: {
        templateId: id,
        version: 4,
        name: "Support",
        budget: 25,
        itemBu: 3,
        maximum: 13,
      },
    });
    await expect(
      POST(request({ budget: 100, count: 4, itemBudget: 11 })),
    ).rejects.toThrow("Could not find a complete group");
  });
  it("excludes templates whose pinned dependencies are no longer accessible", async () => {
    mocks.pin.mockRejectedValue(new Error("Access revoked"));
    await expect(POST(request({ budget: 100, count: 4 }))).rejects.toThrow(
      "Could not find a complete group",
    );
    expect(mocks.pin).toHaveBeenCalledTimes(1);
  });
  it("checks the immutable version budget, rather than trusting a stale catalogue total", async () => {
    mocks.pin.mockResolvedValue({
      summary: {
        templateId: id,
        version: 4,
        name: "Support",
        budget: 50,
        itemBu: 0,
        maximum: 25,
      },
    });
    await expect(POST(request({ budget: 100, count: 4 }))).rejects.toThrow(
      "Could not find a complete group",
    );
  });
  it("validates the request before loading or resolving a group", async () => {
    await expect(POST(request({ budget: 100, count: 201 }))).rejects.toThrow();
    expect(mocks.pin).not.toHaveBeenCalled();
  });
});
