import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ConditionCardItem } from "../conditions-drawer";
import type { RuntimeCondition } from "@/lib/hooks/use-runtime-conditions";

const condition: RuntimeCondition = {
  id: "auto",
  title: "Cornered Combatant",
  description: "",
  source: "sheet-auto",
  active: false,
  manualOverride: true,
  createdAt: 0,
  tags: [],
  durationTier: "manual",
  modifiers: [
    {
      kind: "modify",
      target: "action_roll",
      operation: "add",
      value: { kind: "derived", which: "pb" },
      condition: { kind: "compound", tokens: ["self:is_prone"] },
    },
  ],
};
describe("condition drawer card", () => {
  it("renders the overridden state and readable formulas and conditions", () => {
    const html = renderToStaticMarkup(
      createElement(ConditionCardItem, {
        condition,
        active: true,
        liveActive: false,
        onToggle: () => {},
      }),
    );
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain("+PB");
    expect(html).not.toContain("[object Object]");
    expect(html).not.toContain("&quot;kind&quot;");
    expect(html.toLowerCase()).toContain("prone");
  });
});

it.each(["self", "target", "scene"])(
  "shows the %s trigger beside its label",
  (axis) => {
    const scoped = {
      ...condition,
      modifiers: [
        {
          ...condition.modifiers[0]!,
          condition: { kind: "tags" as const, customTags: [`${axis}:exposed`] },
        },
      ],
    };
    const html = renderToStaticMarkup(
      createElement(ConditionCardItem, {
        condition: scoped,
        active: true,
        liveActive: false,
        onToggle: () => {},
      }),
    );
    expect(html).toContain(
      `${axis[0]!.toUpperCase()}${axis.slice(1)}: exposed`,
    );
    if (axis !== "self")
      expect(html).toContain("does not change your sheet totals");
  },
);
