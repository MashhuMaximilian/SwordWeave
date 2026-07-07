// =============================================================================
// save-intent.test — covers the parse + serialize + label helpers in
// src/lib/publishing/save-intent.ts.
// =============================================================================

import { describe, expect, it } from "vitest";
import {
  parseSaveIntent,
  saveIntentLabel,
  serializeSaveIntent,
} from "../publishing/save-intent";

describe("parseSaveIntent", () => {
  it("returns 'fork' for 'fork'", () => {
    expect(parseSaveIntent("fork")).toBe("fork");
  });

  it("returns 'load' for 'load'", () => {
    expect(parseSaveIntent("load")).toBe("load");
  });

  it("returns null for unknown values", () => {
    expect(parseSaveIntent("frobnicate")).toBe(null);
    expect(parseSaveIntent("")).toBe(null);
    expect(parseSaveIntent("FORK")).toBe(null); // case-sensitive
  });

  it("returns null for undefined", () => {
    expect(parseSaveIntent(undefined)).toBe(null);
  });
});

describe("serializeSaveIntent", () => {
  it("round-trips 'fork'", () => {
    expect(serializeSaveIntent("fork")).toBe("fork");
    expect(parseSaveIntent(serializeSaveIntent("fork") ?? undefined)).toBe("fork");
  });

  it("round-trips 'load'", () => {
    expect(serializeSaveIntent("load")).toBe("load");
    expect(parseSaveIntent(serializeSaveIntent("load") ?? undefined)).toBe("load");
  });

  it("returns null for null input (omits param)", () => {
    expect(serializeSaveIntent(null)).toBe(null);
  });
});

describe("saveIntentLabel", () => {
  it("returns 'Forking <name>' when intent=fork and sourceName set", () => {
    expect(saveIntentLabel("fork", "Strike")).toBe("Forking Strike");
  });

  it("returns 'Forking' when intent=fork and sourceName null", () => {
    expect(saveIntentLabel("fork", null)).toBe("Forking");
  });

  it("returns 'Working on <name>' when intent=load and sourceName set", () => {
    expect(saveIntentLabel("load", "Strike")).toBe("Working on Strike");
  });

  it("returns 'Working on it' when intent=load and sourceName null", () => {
    expect(saveIntentLabel("load", null)).toBe("Working on it");
  });

  it("returns null when intent=null (no chip on clean sandbox)", () => {
    expect(saveIntentLabel(null, "Strike")).toBe(null);
    expect(saveIntentLabel(null, null)).toBe(null);
  });
});