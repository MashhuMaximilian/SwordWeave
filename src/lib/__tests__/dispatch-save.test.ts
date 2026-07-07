// =============================================================================
// dispatch-save.test — covers the 5 cells of the intent × ownership
// matrix from §6.7 of docs/architecture/edit-creates-fork.md.
//
//   ┌──────────────────┬─────────────────┬──────────────────┐
//   │ intent           │ owner           │ expected outcome │
//   ├──────────────────┼─────────────────┼──────────────────┤
//   │ fork             │ any             │ INSERT new fork  │
//   │ load             │ caller owns     │ UPDATE in place  │
//   │ load             │ caller !owns    │ INSERT new fork  │
//   │ null             │ greenfield      │ INSERT new row   │
//   │ any              │ system content  │ INSERT new fork  │
//   └──────────────────┴─────────────────┴──────────────────┘
//
// Phase 1 deliberately does NOT short-circuit on no-change detection
// (that lands in Phase 4) — these tests verify the dispatch decision
// only.
// =============================================================================

import { describe, expect, it } from "vitest";
import {
  decideSaveOutcome,
  type SourceRowIdentity,
} from "../publishing/dispatch-save";

const CALLER = "user_caller";
const OTHER_USER = "user_other";

const OWNED_SOURCE: SourceRowIdentity = { id: 42, userId: CALLER };
const FOREIGN_SOURCE: SourceRowIdentity = { id: 99, userId: OTHER_USER };
const SYSTEM_SOURCE: SourceRowIdentity = { id: 7, userId: null };

describe("decideSaveOutcome — intent × ownership matrix", () => {
  it("intent=fork + caller owns source → fork (swap target)", () => {
    const outcome = decideSaveOutcome({
      intent: "fork",
      source: OWNED_SOURCE,
      callerUserId: CALLER,
    });
    expect(outcome.kind).toBe("forked");
    if (outcome.kind === "forked") {
      expect(outcome.sourceId).toBe(42);
      expect(outcome.swapTarget).toBe(true);
    }
  });

  it("intent=fork + caller does NOT own → fork (swap target)", () => {
    const outcome = decideSaveOutcome({
      intent: "fork",
      source: FOREIGN_SOURCE,
      callerUserId: CALLER,
    });
    expect(outcome.kind).toBe("forked");
    if (outcome.kind === "forked") {
      expect(outcome.sourceId).toBe(99);
      expect(outcome.swapTarget).toBe(true);
    }
  });

  it("intent=fork + system content (userId IS NULL) → fork", () => {
    const outcome = decideSaveOutcome({
      intent: "fork",
      source: SYSTEM_SOURCE,
      callerUserId: CALLER,
    });
    expect(outcome.kind).toBe("forked");
    if (outcome.kind === "forked") {
      expect(outcome.sourceId).toBe(7);
      expect(outcome.swapTarget).toBe(true);
    }
  });

  it("intent=load + caller owns source → UPDATE in place (no swap)", () => {
    const outcome = decideSaveOutcome({
      intent: "load",
      source: OWNED_SOURCE,
      callerUserId: CALLER,
    });
    expect(outcome.kind).toBe("version-update");
    if (outcome.kind === "version-update") {
      expect(outcome.newId).toBe(42);
      expect(outcome.sourceId).toBe(42);
      expect(outcome.swapTarget).toBe(false);
    }
  });

  it("intent=load + caller does NOT own → fork (swap target)", () => {
    const outcome = decideSaveOutcome({
      intent: "load",
      source: FOREIGN_SOURCE,
      callerUserId: CALLER,
    });
    expect(outcome.kind).toBe("forked");
    if (outcome.kind === "forked") {
      expect(outcome.sourceId).toBe(99);
      expect(outcome.swapTarget).toBe(true);
    }
  });

  it("intent=load + system content → fork (system treated as non-owner)", () => {
    const outcome = decideSaveOutcome({
      intent: "load",
      source: SYSTEM_SOURCE,
      callerUserId: CALLER,
    });
    expect(outcome.kind).toBe("forked");
    if (outcome.kind === "forked") {
      expect(outcome.sourceId).toBe(7);
      expect(outcome.swapTarget).toBe(true);
    }
  });

  it("intent=null + caller owns source → version-update (defaults to load semantics)", () => {
    const outcome = decideSaveOutcome({
      intent: null,
      source: OWNED_SOURCE,
      callerUserId: CALLER,
    });
    expect(outcome.kind).toBe("version-update");
  });

  it("intent=null + greenfield (source=null) → fresh INSERT", () => {
    const outcome = decideSaveOutcome({
      intent: null,
      source: null,
      callerUserId: CALLER,
    });
    expect(outcome.kind).toBe("forked");
    if (outcome.kind === "forked") {
      expect(outcome.sourceId).toBe(null);
      expect(outcome.swapTarget).toBe(false);
    }
  });

  it("intent=null + foreign source → fork (greenfield semantics for foreign)", () => {
    const outcome = decideSaveOutcome({
      intent: null,
      source: FOREIGN_SOURCE,
      callerUserId: CALLER,
    });
    expect(outcome.kind).toBe("forked");
    if (outcome.kind === "forked") {
      expect(outcome.sourceId).toBe(99);
      expect(outcome.swapTarget).toBe(true);
    }
  });
});

describe("decideSaveOutcome — invariants", () => {
  it("version-update always has swapTarget=false", () => {
    const outcome = decideSaveOutcome({
      intent: "load",
      source: OWNED_SOURCE,
      callerUserId: CALLER,
    });
    expect(outcome.kind).toBe("version-update");
    if (outcome.kind === "version-update") {
      expect(outcome.swapTarget).toBe(false);
    }
  });

  it("forked+non-null source always has swapTarget=true", () => {
    const cases: Array<SourceRowIdentity> = [
      OWNED_SOURCE,
      FOREIGN_SOURCE,
      SYSTEM_SOURCE,
    ];
    for (const source of cases) {
      const outcome = decideSaveOutcome({
        intent: "fork",
        source,
        callerUserId: CALLER,
      });
      if (outcome.kind === "forked" && outcome.sourceId !== null) {
        expect(outcome.swapTarget).toBe(true);
      }
    }
  });

  it("forked+null source has swapTarget=false (greenfield INSERT)", () => {
    const outcome = decideSaveOutcome({
      intent: "fork",
      source: null,
      callerUserId: CALLER,
    });
    expect(outcome.kind).toBe("forked");
    if (outcome.kind === "forked") {
      expect(outcome.sourceId).toBe(null);
      expect(outcome.swapTarget).toBe(false);
    }
  });
});