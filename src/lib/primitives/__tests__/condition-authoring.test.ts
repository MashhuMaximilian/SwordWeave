import { describe, expect, it } from "vitest";
import { removeConditionClause } from "../condition-authoring";
import type { ConditionAuthoring } from "@/types/condition";

describe("inline sentence condition removal", () => {
  const value: ConditionAuthoring = {
    categories: ["self", "scene"], includeTags: true, narrative: "while holding a shield",
    pills: [{category:"self",label:"Wounded"},{category:"scene",label:"Dark"},{category:"self",label:"Prone"}],
    operators: ["AND", "OR"],
  };
  it("preserves remaining joins and narrative when removing first, middle, or last clause", () => {
    expect(removeConditionClause(value, 0).operators).toEqual(["OR"]);
    expect(removeConditionClause(value, 1).operators).toEqual(["OR"]);
    expect(removeConditionClause(value, 2).operators).toEqual(["AND"]);
    expect(removeConditionClause(value, 1).pills.map(pill => pill.label)).toEqual(["Wounded", "Prone"]);
    expect(removeConditionClause(value, 1).narrative).toBe(value.narrative);
    expect(value.pills).toHaveLength(3);
  });
  it("leaves no dangling join after the final clause is removed", () => {
    let next = value;
    for (let i = 0; i < 3; i++) next = removeConditionClause(next, 0);
    expect(next.pills).toEqual([]);
    expect(next.operators).toEqual([]);
    expect(next.narrative).toBe(value.narrative);
  });
});
