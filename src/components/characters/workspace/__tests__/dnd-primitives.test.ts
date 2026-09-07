import { describe, expect, it } from "vitest";
import {
  CHIP_MIME,
  decodeChipPayload,
  encodeChipPayload,
  type ChipDragPayload,
} from "@/components/characters/workspace/dnd-primitives";

describe("Phase 9.2 chip drag payload encoding", () => {
  it("round-trips a primitive-instance payload", () => {
    const payload: ChipDragPayload = {
      kind: "primitive-instance",
      characterId: "char_123",
      instanceId: "inst_abc",
      primitiveId: 42,
      source: "LINEAGE",
    };
    const encoded = encodeChipPayload(payload);
    const decoded = decodeChipPayload(encoded);
    expect(decoded).toEqual(payload);
  });

  it("round-trips a primitive-template payload", () => {
    const payload: ChipDragPayload = {
      kind: "primitive-template",
      characterId: "char_456",
      primitiveId: 99,
      source: "MANIFEST",
    };
    const decoded = decodeChipPayload(encodeChipPayload(payload));
    expect(decoded).toEqual(payload);
  });

  it("rejects malformed JSON", () => {
    expect(decodeChipPayload("not json")).toBeNull();
    expect(decodeChipPayload("{")).toBeNull();
    expect(decodeChipPayload("")).toBeNull();
  });

  it("rejects payloads missing required fields", () => {
    expect(decodeChipPayload(JSON.stringify({ kind: "primitive-instance" }))).toBeNull();
    expect(
      decodeChipPayload(
        JSON.stringify({
          kind: "primitive-instance",
          characterId: "x",
          primitiveId: "not-a-number",
        }),
      ),
    ).toBeNull();
    expect(decodeChipPayload(JSON.stringify({ random: "garbage" }))).toBeNull();
  });

  it("rejects unknown kind values", () => {
    expect(
      decodeChipPayload(
        JSON.stringify({
          kind: "capability",
          characterId: "x",
          primitiveId: 1,
        }),
      ),
    ).toBeNull();
  });

  it("exports a stable MIME constant (don't break the protocol)", () => {
    expect(CHIP_MIME).toBe("application/x-swordweave-chip");
  });
});
