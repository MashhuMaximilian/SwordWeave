import { expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/components/icons/icon-slot", () => ({ IconSlot: () => null }));
import { HeritageForm } from "../heritage-form";
it("renders supplied formalization slots on the first render without global events", () => {
  const html = renderToStaticMarkup(
    createElement(HeritageForm, {
      initialKind: "MANIFEST",
      initialPrimitiveIds: [1, 2, 1],
      initialCapabilityIds: ["cap-1"],
      initialMirroredIds: [2],
      availablePrimitives: [
        { id: 1, name: "Cornered Combatant", category: "MODIFIER", buCost: 1 },
        { id: 2, name: "Enfeebling Venom", category: "MODIFIER", buCost: 2 },
      ],
      availableCapabilities: [
        {
          id: "cap-1",
          name: "Combat training",
          type: "capability",
          sourceType: "character",
        },
      ],
    }),
  );
  expect(html).toContain("Cornered Combatant");
  expect(html).toContain("Enfeebling Venom");
  expect(html).toContain("Combat training");
  expect(html).not.toContain("No primitives slotted");
  expect(html).not.toContain("No capabilities bundled");
  expect(html).toContain("Create Manifest");
});
