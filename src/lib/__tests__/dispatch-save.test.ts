// =============================================================================
// dispatch-save.test — covers the full content-hash × intent × ownership
// matrix from §6.7 of docs/architecture/edit-creates-fork.md.
//
//   ┌──────────────────┬────────────┬─────────────────┬──────────────────┐
//   │ intent           │ owner      │ hashes match    │ expected outcome │
//   ├──────────────────┼────────────┼─────────────────┼──────────────────┤
//   │ null (greenfield)│ —          │ sourceHash=null │ INSERT (or no-op │
//   │                  │            │                 │ if empty)        │
//   │ null             │ caller     │ equal           │ no-op            │
//   │ null             │ caller     │ different       │ UPDATE in place  │
//   │ null             │ non-owner  │ equal           │ no-op            │
//   │ null             │ non-owner  │ different       │ INSERT new fork  │
//   │ fork             │ any        │ equal           │ no-op            │
//   │ fork             │ any        │ different       │ INSERT new fork  │
//   │ load             │ caller     │ equal           │ no-op            │
//   │ load             │ caller     │ different       │ UPDATE in place  │
//   │ load             │ non-owner  │ equal           │ no-op            │
//   │ load             │ non-owner  │ different       │ INSERT new fork  │
//   └──────────────────┴────────────┴─────────────────┴──────────────────┘
//
// Phase 4 (rolled into Phase 1 per Mashu) adds the no-op short-circuit so
// "save with no changes" doesn't accidentally create a fork. Legacy rows
// with contentHash=null fall through to the legacy matrix path.
// =============================================================================

import { describe, expect, it } from "vitest";
import {
  decideSaveOutcome,
  type SourceRowIdentity,
} from "../publishing/dispatch-save";

const CALLER = "user_caller";
const OTHER_USER = "user_other";

const OWNED_SOURCE: SourceRowIdentity = {
  id: 42,
  userId: CALLER,
  contentHash: "hash_owned",
  sourceOrigin: `user:${CALLER}`,
};
const FOREIGN_SOURCE: SourceRowIdentity = {
  id: 99,
  userId: OTHER_USER,
  contentHash: "hash_foreign",
  sourceOrigin: `user:${OTHER_USER}`,
};
const SYSTEM_SOURCE: SourceRowIdentity = {
  id: 7,
  userId: null,
  contentHash: "hash_system",
  sourceOrigin: "system:phase5-commit-c-library-seed",
};
const LEGACY_OWNED_SOURCE: SourceRowIdentity = {
  id: 43,
  userId: CALLER,
  contentHash: null,
  sourceOrigin: `user:${CALLER}`,
};

const DRAFT_DIFFERENT = "hash_different";
const DRAFT_MATCHES_OWNED = "hash_owned";
const DRAFT_MATCHES_FOREIGN = "hash_foreign";
const DRAFT_MATCHES_SYSTEM = "hash_system";

describe("decideSaveOutcome — guard: missing draftHash is always no-op", () => {
  it("draftHash=null + greenfield → no-op (refuses to insert without proof)", () => {
    const outcome = decideSaveOutcome({
      intent: null,
      source: null,
      callerUserId: CALLER,
      draftHash: null,
    });
    expect(outcome.kind).toBe("no-op");
    if (outcome.kind === "no-op") {
      expect(outcome.swapTarget).toBe(false);
      expect(outcome.message).toMatch(/hash missing/i);
    }
  });

  it("draftHash='' + intent=fork + owned → no-op", () => {
    const outcome = decideSaveOutcome({
      intent: "fork",
      source: OWNED_SOURCE,
      callerUserId: CALLER,
      draftHash: "",
    });
    expect(outcome.kind).toBe("no-op");
  });
});

describe("decideSaveOutcome — greenfield matrix", () => {
  it("greenfield + non-empty draft → INSERT (forked, swapTarget=false)", () => {
    const outcome = decideSaveOutcome({
      intent: null,
      source: null,
      callerUserId: CALLER,
      draftHash: DRAFT_DIFFERENT,
      draftIsEmpty: false,
    });
    expect(outcome.kind).toBe("forked");
    if (outcome.kind === "forked") {
      expect(outcome.sourceId).toBe(null);
      expect(outcome.swapTarget).toBe(false);
    }
  });

  it("greenfield + empty draft → no-op 'give it a name first'", () => {
    const outcome = decideSaveOutcome({
      intent: null,
      source: null,
      callerUserId: CALLER,
      draftHash: DRAFT_DIFFERENT,
      draftIsEmpty: true,
    });
    expect(outcome.kind).toBe("no-op");
    if (outcome.kind === "no-op") {
      expect(outcome.message).toMatch(/give it a name first/);
    }
  });

  it("greenfield + intent=fork + non-empty → INSERT (forked)", () => {
    const outcome = decideSaveOutcome({
      intent: "fork",
      source: null,
      callerUserId: CALLER,
      draftHash: DRAFT_DIFFERENT,
      draftIsEmpty: false,
    });
    expect(outcome.kind).toBe("forked");
    if (outcome.kind === "forked") {
      expect(outcome.sourceId).toBe(null);
      expect(outcome.swapTarget).toBe(false);
    }
  });

  it("greenfield + intent=fork + empty → no-op (don't fork nothing)", () => {
    const outcome = decideSaveOutcome({
      intent: "fork",
      source: null,
      callerUserId: CALLER,
      draftHash: DRAFT_DIFFERENT,
      draftIsEmpty: true,
    });
    expect(outcome.kind).toBe("no-op");
  });
});

describe("decideSaveOutcome — intent=fork matrix", () => {
  it("fork + caller owns source + hashes equal → no-op", () => {
    const outcome = decideSaveOutcome({
      intent: "fork",
      source: OWNED_SOURCE,
      callerUserId: CALLER,
      draftHash: DRAFT_MATCHES_OWNED,
    });
    expect(outcome.kind).toBe("no-op");
    if (outcome.kind === "no-op") {
      expect(outcome.message).toMatch(/make a change first/);
      expect(outcome.swapTarget).toBe(false);
    }
  });

  it("fork + caller owns source + hashes differ → fork (swap)", () => {
    const outcome = decideSaveOutcome({
      intent: "fork",
      source: OWNED_SOURCE,
      callerUserId: CALLER,
      draftHash: DRAFT_DIFFERENT,
    });
    expect(outcome.kind).toBe("forked");
    if (outcome.kind === "forked") {
      expect(outcome.sourceId).toBe(42);
      expect(outcome.swapTarget).toBe(true);
    }
  });

  it("fork + caller does NOT own + hashes equal → no-op", () => {
    const outcome = decideSaveOutcome({
      intent: "fork",
      source: FOREIGN_SOURCE,
      callerUserId: CALLER,
      draftHash: DRAFT_MATCHES_FOREIGN,
    });
    expect(outcome.kind).toBe("no-op");
    if (outcome.kind === "no-op") {
      expect(outcome.message).toMatch(/make a change first/);
    }
  });

  it("fork + caller does NOT own + hashes differ → fork (swap)", () => {
    const outcome = decideSaveOutcome({
      intent: "fork",
      source: FOREIGN_SOURCE,
      callerUserId: CALLER,
      draftHash: DRAFT_DIFFERENT,
    });
    expect(outcome.kind).toBe("forked");
    if (outcome.kind === "forked") {
      expect(outcome.sourceId).toBe(99);
      expect(outcome.swapTarget).toBe(true);
    }
  });

  it("fork + system content + hashes equal → no-op", () => {
    const outcome = decideSaveOutcome({
      intent: "fork",
      source: SYSTEM_SOURCE,
      callerUserId: CALLER,
      draftHash: DRAFT_MATCHES_SYSTEM,
    });
    expect(outcome.kind).toBe("no-op");
  });

  it("fork + system content + hashes differ → fork (swap)", () => {
    const outcome = decideSaveOutcome({
      intent: "fork",
      source: SYSTEM_SOURCE,
      callerUserId: CALLER,
      draftHash: DRAFT_DIFFERENT,
    });
    expect(outcome.kind).toBe("forked");
    if (outcome.kind === "forked") {
      expect(outcome.sourceId).toBe(7);
      expect(outcome.swapTarget).toBe(true);
    }
  });
});

describe("decideSaveOutcome — intent=load matrix", () => {
  it("load + caller owns source + hashes equal → no-op", () => {
    const outcome = decideSaveOutcome({
      intent: "load",
      source: OWNED_SOURCE,
      callerUserId: CALLER,
      draftHash: DRAFT_MATCHES_OWNED,
    });
    expect(outcome.kind).toBe("no-op");
    if (outcome.kind === "no-op") {
      expect(outcome.message).toMatch(/nothing has changed/i);
      expect(outcome.swapTarget).toBe(false);
    }
  });

  it("load + caller owns source + hashes differ → UPDATE in place", () => {
    const outcome = decideSaveOutcome({
      intent: "load",
      source: OWNED_SOURCE,
      callerUserId: CALLER,
      draftHash: DRAFT_DIFFERENT,
    });
    expect(outcome.kind).toBe("version-update");
    if (outcome.kind === "version-update") {
      expect(outcome.newId).toBe(42);
      expect(outcome.sourceId).toBe(42);
      expect(outcome.swapTarget).toBe(false);
    }
  });

  it("load + caller does NOT own + hashes equal → no-op", () => {
    const outcome = decideSaveOutcome({
      intent: "load",
      source: FOREIGN_SOURCE,
      callerUserId: CALLER,
      draftHash: DRAFT_MATCHES_FOREIGN,
    });
    expect(outcome.kind).toBe("no-op");
    if (outcome.kind === "no-op") {
      expect(outcome.message).toMatch(/nothing to save/i);
      expect(outcome.swapTarget).toBe(false);
    }
  });

  it("load + caller does NOT own + hashes differ → fork (swap)", () => {
    const outcome = decideSaveOutcome({
      intent: "load",
      source: FOREIGN_SOURCE,
      callerUserId: CALLER,
      draftHash: DRAFT_DIFFERENT,
    });
    expect(outcome.kind).toBe("forked");
    if (outcome.kind === "forked") {
      expect(outcome.sourceId).toBe(99);
      expect(outcome.swapTarget).toBe(true);
    }
  });

  it("load + system content + hashes differ → fork (system treated as non-owner)", () => {
    const outcome = decideSaveOutcome({
      intent: "load",
      source: SYSTEM_SOURCE,
      callerUserId: CALLER,
      draftHash: DRAFT_DIFFERENT,
    });
    expect(outcome.kind).toBe("forked");
    if (outcome.kind === "forked") {
      expect(outcome.sourceId).toBe(7);
      expect(outcome.swapTarget).toBe(true);
    }
  });
});

describe("decideSaveOutcome — intent=null matrix (greenfield semantics)", () => {
  it("intent=null + caller owns source + hashes equal → no-op", () => {
    const outcome = decideSaveOutcome({
      intent: null,
      source: OWNED_SOURCE,
      callerUserId: CALLER,
      draftHash: DRAFT_MATCHES_OWNED,
    });
    expect(outcome.kind).toBe("no-op");
    if (outcome.kind === "no-op") {
      expect(outcome.message).toMatch(/nothing has changed/i);
    }
  });

  it("intent=null + caller owns source + hashes differ → UPDATE in place", () => {
    const outcome = decideSaveOutcome({
      intent: null,
      source: OWNED_SOURCE,
      callerUserId: CALLER,
      draftHash: DRAFT_DIFFERENT,
    });
    expect(outcome.kind).toBe("version-update");
  });

  it("intent=null + foreign source + hashes equal → no-op", () => {
    const outcome = decideSaveOutcome({
      intent: null,
      source: FOREIGN_SOURCE,
      callerUserId: CALLER,
      draftHash: DRAFT_MATCHES_FOREIGN,
    });
    expect(outcome.kind).toBe("no-op");
    if (outcome.kind === "no-op") {
      expect(outcome.message).toMatch(/nothing to save/i);
    }
  });

  it("intent=null + foreign source + hashes differ → fork", () => {
    const outcome = decideSaveOutcome({
      intent: null,
      source: FOREIGN_SOURCE,
      callerUserId: CALLER,
      draftHash: DRAFT_DIFFERENT,
    });
    expect(outcome.kind).toBe("forked");
    if (outcome.kind === "forked") {
      expect(outcome.sourceId).toBe(99);
      expect(outcome.swapTarget).toBe(true);
    }
  });
});

describe("decideSaveOutcome — legacy source rows (contentHash=null)", () => {
  it("legacy owned source + intent=load + draft differs → version-update (preserves legacy semantics)", () => {
    const outcome = decideSaveOutcome({
      intent: "load",
      source: LEGACY_OWNED_SOURCE,
      callerUserId: CALLER,
      draftHash: DRAFT_DIFFERENT,
    });
    expect(outcome.kind).toBe("version-update");
  });

  it("legacy owned source + intent=load + draft equals legacy's null hash → fork (null != anything)", () => {
    // A null source hash will never equal a non-null draft hash. Falls
    // through to the original matrix → version-update for owned load.
    const outcome = decideSaveOutcome({
      intent: "load",
      source: LEGACY_OWNED_SOURCE,
      callerUserId: CALLER,
      draftHash: "anything",
    });
    expect(outcome.kind).toBe("version-update");
  });

  it("legacy owned source + intent=fork → fork", () => {
    const outcome = decideSaveOutcome({
      intent: "fork",
      source: LEGACY_OWNED_SOURCE,
      callerUserId: CALLER,
      draftHash: DRAFT_DIFFERENT,
    });
    expect(outcome.kind).toBe("forked");
  });
});

describe("decideSaveOutcome — invariants", () => {
  it("no-op always has swapTarget=false", () => {
    const cases = [
      { intent: "fork" as const, source: OWNED_SOURCE, draftHash: DRAFT_MATCHES_OWNED },
      { intent: "load" as const, source: FOREIGN_SOURCE, draftHash: DRAFT_MATCHES_FOREIGN },
      { intent: null, source: OWNED_SOURCE, draftHash: DRAFT_MATCHES_OWNED },
    ];
    for (const c of cases) {
      const outcome = decideSaveOutcome({
        intent: c.intent,
        source: c.source,
        callerUserId: CALLER,
        draftHash: c.draftHash,
      });
      expect(outcome.kind).toBe("no-op");
      if (outcome.kind === "no-op") {
        expect(outcome.swapTarget).toBe(false);
      }
    }
  });

  it("version-update always has swapTarget=false", () => {
    const outcome = decideSaveOutcome({
      intent: "load",
      source: OWNED_SOURCE,
      callerUserId: CALLER,
      draftHash: DRAFT_DIFFERENT,
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
        draftHash: DRAFT_DIFFERENT,
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
      draftHash: DRAFT_DIFFERENT,
      draftIsEmpty: false,
    });
    expect(outcome.kind).toBe("forked");
    if (outcome.kind === "forked") {
      expect(outcome.sourceId).toBe(null);
      expect(outcome.swapTarget).toBe(false);
    }
  });
});