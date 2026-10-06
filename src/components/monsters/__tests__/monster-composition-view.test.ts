import { describe, expect, it, vi } from "vitest";
vi.mock("@/components/preview/entity-preview", () => ({}));
vi.mock("@/components/characters/compact-hierarchy", () => ({}));
vi.mock("@/components/ui/instrument-dialog", () => ({}));
vi.mock("@/components/library/version-preview-button", () => ({}));
vi.mock("../monster-component-preview", () => ({}));
import { monsterCompositionBranches, monsterSavedPreviewContext } from "../monster-composition-view";
import type { MonsterSlot } from "@/lib/monsters/resolve";
import type { PinnedDefinition } from "@/lib/monsters/service";
import type { MonsterComponentPin } from "@/lib/monsters/composition";
const primitive: MonsterComponentPin = { key:"primitive:7:saved", kind:"primitive", id:"7", name:"Saved claw", versionId:"saved", links:[] };
const effect: MonsterComponentPin = { key:"effect:e:v1", kind:"effect", id:"e", name:"Strike", versionId:"v1", links:[{kind:"primitive",id:"7",data:{versionId:"saved",quantity:3,isMirrored:true}}] };
const cap: MonsterComponentPin = { key:"capability:c:v1", kind:"capability", id:"c", name:"Predator", versionId:"v1", links:[{kind:"effect",id:"e",data:{versionId:"v1",quantity:2}}] };
const definition = (pins: MonsterComponentPin[]) => ({references:[{kind:"CAPABILITY",id:"c",versionId:"v1",quantity:2,isMirrored:true}],componentPins:pins} as unknown as PinnedDefinition);
describe("saved monster composition", () => {
  it("preserves capability, effect, primitive nesting, quantity and mirror parity", () => {
    const tree = monsterCompositionBranches(definition([cap,effect,primitive]), []);
    const leaf = tree[0]!.children[0]!.children[0]!;
    expect(tree[0]!.pin.name).toBe("Predator");
    expect(tree[0]!.children[0]!.pin.name).toBe("Strike");
    expect(leaf.pin.name).toBe("Saved claw");
    expect(leaf.reference.quantity).toBe(12);
    expect(leaf.reference.isMirrored).toBe(false);
  });
  it("never replaces a missing saved version with another version", () => {
    const tree = monsterCompositionBranches(definition([cap,effect,{...primitive,key:"primitive:7:latest",versionId:"latest"}]), []);
    expect(tree[0]!.children[0]!.children).toEqual([]);
  });
  it("uses the saved dependency's cost and relative effect quantity, ignoring a newer version", () => {
    const slots = [{primitiveId:7,buCost:4,dependencyVersions:[primitive.key]}, {primitiveId:7,buCost:99,dependencyVersions:["primitive:7:latest"]}] as MonsterSlot[];
    const context = monsterSavedPreviewContext(cap, [cap,effect,primitive], slots);
    expect(context.primitiveBuCosts).toEqual({7:4});
    expect(context.effectPrimitiveLinks).toEqual({e:[{primitiveId:7,quantity:3}]});
  });
  it("bounds cyclic saved edges while retaining the visible parent cards", () => {
    const cyclic = {...effect,links:[{kind:"capability" as const,id:"c",data:{versionId:"v1"}}]};
    const tree = monsterCompositionBranches(definition([cap,cyclic]), []);
    expect(tree[0]!.children[0]!.children[0]!.truncated).toBe(true);
    expect(tree[0]!.children[0]!.children[0]!.children).toEqual([]);
  });
});
