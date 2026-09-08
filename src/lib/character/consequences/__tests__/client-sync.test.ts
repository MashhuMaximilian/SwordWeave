import { consequenceJson } from "../json";
import { afterEach, expect, it, vi } from "vitest";
import { connectConsequenceSync, consequenceSyncReady } from "../client-sync";

afterEach(() => vi.unstubAllGlobals());
it("does not mark a fresh browser ready until saved overrides are installed", async () => {
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    get length() { return values.size; }, key: (i: number) => [...values.keys()][i] ?? null,
    getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => values.set(k,v), removeItem: (k: string) => values.delete(k),
  });
  vi.stubGlobal("window", new EventTarget());
  vi.stubGlobal("document", { visibilityState: "visible" });
  let finish!: (response: Response) => void;
  const occurrence = {id: "sheet-auto-primitive-42-0", title: "Saved Self override", manualOverride: true, active: false};
  const records = [{id: occurrence.id, revision: 5, occurrence}];
  vi.stubGlobal("fetch", vi.fn().mockImplementationOnce(() => new Promise(resolve => {finish=resolve;})).mockResolvedValue({ok: true, json: async () => ({records})}));
  const disconnect = connectConsequenceSync("fresh-sync-test");
  try {
    expect(consequenceSyncReady("fresh-sync-test")).toBe(false);
    finish(Response.json({records}));
    await vi.waitFor(() => expect(consequenceSyncReady("fresh-sync-test")).toBe(true));
    expect(JSON.parse(values.get(`sw:cond:fresh-sync-test:${occurrence.id}`)!)).toMatchObject({manualOverride: true});
  } finally { disconnect(); }
});

it("compares reordered database JSON as unchanged while keeping modifier order meaningful", () => {
  const local = { modifiers: [{kind: "modify", target: "save_dc", operation: "subtract", value: 1, condition: {kind: "tags", customTags: ["self:exposed"]}}] };
  const server = { modifiers: [{value: 1, kind: "modify", condition: {customTags: ["self:exposed"], kind: "tags"}, operation: "subtract", target: "save_dc"}] };
  expect(consequenceJson(local)).toBe(consequenceJson(server));
  expect(consequenceJson([{value: 1},{value: 2}])).not.toBe(consequenceJson([{value: 2},{value: 1}]));
  expect(consequenceJson({...local, manualOverride: true})).not.toBe(consequenceJson(local));
});
