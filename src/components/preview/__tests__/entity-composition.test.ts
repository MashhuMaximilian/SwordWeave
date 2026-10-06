import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { EntityPreview } from "../entity-preview";
import type { SandboxPreviewItem } from "@/components/library/library-item-preview";

vi.mock("@/components/icons/icon-display", () => ({ IconDisplay: () => null }));
vi.mock("@/components/ui/modal-stack", () => ({ useModalStack: () => ({ canPush: false }) }));

const primitive = { id: 42, name: "Beacon light", category: "BEHAVIOR", buCost: 3, mechanicalOutputText: "Emit light within 30 feet." };
const base = { id: "test", name: "Beacon", tags: [], isPublic: true, iconSource: null, iconKey: null, iconUrl: null, iconColor: "#ffffff" };
function render(kind: SandboxPreviewItem["kind"], extra: Record<string, unknown>) {
  return renderToStaticMarkup(createElement(EntityPreview, {
    item: { kind, row: { ...base, ...extra } } as unknown as SandboxPreviewItem,
    variant: "build",
  }));
}

describe("composite preview composition cards", () => {
  it.each(["effect", "capability", "heritage", "item"] as const)("renders direct primitives with the monster tree in %s", kind => {
    const markup = render(kind, {
      primitiveLinks: [{ primitiveId: 42, quantity: 2, versionNumber: 7, primitive }],
      capabilityLinks: [], effectLinks: [], kind: "LINEAGE", type: "ACTION",
      buCost: 0, itemType: "WORN", rarity: "COMMON", slotCost: 1,
    });
    expect(markup).toContain('class="v12-composition-tree"');
    expect(markup).toContain('data-entity-kind="primitive"');
    expect(markup).toContain("Beacon light");
    expect(markup).toContain("Emit light within 30 feet.");
    expect(markup).not.toContain("v12-composed-ledger-row");
  });

  it("expands an item capability whose effect primitives live inside the effect payload", () => {
    const markup = render("item", {
      itemType: "WORN", rarity: "COMMON", slotCost: 1, buCost: 0,
      primitiveLinks: [], effectLinks: [],
      capabilityLinks: [{ capabilityId: "cap", capability: {
        id: "cap", name: "Beacon ward", type: "PASSIVE", primitiveLinks: [],
        effectLinks: [{ effectId: "eff", effect: { id: "eff", name: "Radiance", primitiveLinks: [{ primitiveId: 42, quantity: 1, primitive }] } }],
      } }],
    });
    expect(markup).toContain('data-entity-kind="capability"');
    expect(markup).toContain('data-entity-kind="effect"');
    expect(markup).toContain('aria-label="Expand Radiance"');
    expect(markup).toContain("3</b><small>BU");
  });
  it("uses link quantities for capability primitive cards and effect BU", () => {
    const markup = render("item", {
      itemType: "WORN", rarity: "COMMON", slotCost: 1, buCost: 0,
      primitiveLinks: [], effectLinks: [],
      capabilityLinks: [{ capabilityId: "cap", capability: {
        id: "cap", name: "Beacon ward", type: "PASSIVE",
        primitiveLinks: [{ primitiveId: 42, quantity: 2, primitive }],
        effectLinks: [{ effectId: "eff", primitiveLinks: [{ primitiveId: 43, quantity: 4, primitive: { ...primitive, id: 43 } }], effect: { id: "eff", name: "Radiance" } }],
      } }],
    });
    expect(markup).toMatch(/data-entity-kind="primitive"[\s\S]*?6<\/b><small>BU/);
    expect(markup).toMatch(/data-entity-kind="effect"[\s\S]*?12<\/b><small>BU/);
    expect(markup).toContain("18</b><small>BU");
  });

  it("can suppress the inner composite identity for a surrounding inspector", () => {
    const markup = renderToStaticMarkup(createElement(EntityPreview, {
      item: { kind: "effect", row: { ...base, primitiveLinks: [], narrativeDescription: null } } as unknown as SandboxPreviewItem,
      variant: "build", showIdentity: false, showOwner: false,
    }));
    expect(markup).not.toContain("v12-preview-identity");
  });

});
