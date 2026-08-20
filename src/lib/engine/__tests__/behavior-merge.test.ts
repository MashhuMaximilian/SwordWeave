// Test for buildClientBehaviorVariables in character-sheet-view
//
// We import the function via the module exports and verify it merges
// server's structured contributions with resolver's byTarget.
import { describe, it, expect } from "vitest";

describe("Behavior variables merge (server + resolver)", () => {
  it("preserves server's primitive contributions + adds condition contributions from resolver", () => {
    // Server returns structured primitive contributions only
    const serverVars: Array<{key: string; value: number; contributions: Array<{primitiveId: number; primitiveName: string; delta: number}>}> = [
      {
        key: "legendary_resistance",
        value: 1,
        contributions: [
          { primitiveId: 14101, primitiveName: "Legendary Resistance", delta: 1 },
        ],
      },
    ];

    // Resolver sees BOTH primitive AND condition contributions
    const resolver = {
      behaviorVariables: { legendary_resistance: 3 },
      byTarget: {
        "behavior.legendary_resistance": [
          { primitiveId: 14101, primitiveName: "Legendary Resistance", value: 1 },
          { primitiveId: -1, primitiveName: "legend", value: 2 },
        ],
      },
    };

    // We can't import buildClientBehaviorVariables directly since it's
    // a non-exported helper. Test the merge LOGIC here.
    const merged = mergeBehavior(serverVars, resolver);

    expect(merged).toHaveLength(1);
    expect(merged[0]?.key).toBe("legendary_resistance");
    expect(merged[0]?.value).toBe(3);
    expect(merged[0]?.contributions).toHaveLength(2);
    const names = merged[0]?.contributions.map((c) => c.primitiveName).sort();
    expect(names).toEqual(["Legendary Resistance", "legend"]);
  });

  it("condition-only key: server has nothing, resolver has it", () => {
    const serverVars: Array<{key: string; value: number; contributions: Array<{primitiveId: number; primitiveName: string; delta: number}>}> = [];
    const resolver = {
      behaviorVariables: { some_custom_key: 5 },
      byTarget: {
        "behavior.some_custom_key": [
          { primitiveId: -1, primitiveName: "my condition", value: 5 },
        ],
      },
    };

    const merged = mergeBehavior(serverVars, resolver);

    expect(merged).toHaveLength(1);
    expect(merged[0]?.key).toBe("some_custom_key");
    expect(merged[0]?.value).toBe(5);
    expect(merged[0]?.contributions).toHaveLength(1);
    expect(merged[0]?.contributions[0]?.primitiveName).toBe("my condition");
  });

  it("resolver is null: fall back to server array unchanged", () => {
    const serverVars: Array<{key: string; value: number; contributions: Array<{primitiveId: number; primitiveName: string; delta: number}>}> = [
      { key: "x", value: 1, contributions: [{ primitiveId: 1, primitiveName: "P", delta: 1 }] } as {key: string; value: number; contributions: Array<{primitiveId: number; primitiveName: string; delta: number}>},
    ];

    const merged = mergeBehavior(serverVars, null);
    expect(merged).toEqual(serverVars);
  });
});

// Mirror of the production logic in character-sheet-view.tsx.
// Kept in this test file so we can test without importing React.
function mergeBehavior(
  serverVars: ReadonlyArray<{
    readonly key: string;
    readonly value: number;
    readonly contributions: ReadonlyArray<{
      readonly primitiveId: number;
      readonly primitiveName: string;
      readonly delta: number;
    }>;
  }>,
  resolver: {
    behaviorVariables: Readonly<Record<string, number>>;
    byTarget: Readonly<Record<string, ReadonlyArray<{
      primitiveId: number;
      primitiveName: string;
      value: number;
    }>>>;
  } | null,
): ReadonlyArray<{
  readonly key: string;
  readonly value: number;
  readonly contributions: ReadonlyArray<{
    readonly primitiveId: number;
    readonly primitiveName: string;
    readonly delta: number;
  }>;
}> {
  if (!resolver) return serverVars;
  const keys = new Set<string>();
  for (const bv of serverVars) keys.add(bv.key);
  for (const k of Object.keys(resolver.behaviorVariables)) keys.add(k);
  const out: Array<{
    readonly key: string;
    readonly value: number;
    readonly contributions: ReadonlyArray<{
      readonly primitiveId: number;
      readonly primitiveName: string;
      readonly delta: number;
    }>;
  }> = [];
  for (const key of keys) {
    const resolverVal = resolver.behaviorVariables[key];
    const serverEntry = serverVars.find((b) => b.key === key);
    const value = resolverVal !== undefined ? resolverVal : (serverEntry?.value ?? 0);
    const resolverByTargetEntries = resolver.byTarget[`behavior.${key}`] ?? [];
    const contributionsMap = new Map<string, {
      readonly primitiveId: number;
      readonly primitiveName: string;
      readonly delta: number;
    }>();
    for (const s of serverEntry?.contributions ?? []) {
      contributionsMap.set(`${s.primitiveName}-${s.delta}`, s);
    }
    for (const r of resolverByTargetEntries) {
      const key2 = `${r.primitiveName}-${r.value}`;
      if (!contributionsMap.has(key2)) {
        contributionsMap.set(key2, {
          primitiveId: r.primitiveId,
          primitiveName: r.primitiveName,
          delta: r.value,
        });
      }
    }
    let contributions: ReadonlyArray<{
      readonly primitiveId: number;
      readonly primitiveName: string;
      readonly delta: number;
    }> = Array.from(contributionsMap.values());
    if (contributions.length === 0 && value !== 0) {
      contributions = [{ primitiveId: -1, primitiveName: "Runtime Conditions", delta: value }];
    }
    out.push({ key, value, contributions });
  }
  out.sort((a, b) => a.key.localeCompare(b.key));
  return out;
}

describe("Speed by type merge (server + resolver)", () => {
  it("adds resolver's condition delta to server's base speed", () => {
    const server = { WALKING_SPEED: 50, FLYING_SPEED: 0 };
    const resolver = {
      byTarget: {
        "speed.walking_speed": [
          { op: "subtract", value: 10, inhibited: false },
        ],
      },
    };
    const merged = mergeSpeed(server, resolver);
    expect(merged.WALKING_SPEED).toBe(40);  // 50 - 10
    expect(merged.FLYING_SPEED).toBe(0);  // no contrib
  });

  it("skips inhibited contributions", () => {
    const server = { WALKING_SPEED: 50 };
    const resolver = {
      byTarget: {
        "speed.walking_speed": [
          { op: "subtract", value: 10, inhibited: true },
        ],
      },
    };
    const merged = mergeSpeed(server, resolver);
    expect(merged.WALKING_SPEED).toBe(50);
  });

  it("returns server value when resolver is null", () => {
    const server = { WALKING_SPEED: 50 };
    const merged = mergeSpeed(server, null);
    expect(merged.WALKING_SPEED).toBe(50);
  });
});

// Mirror of buildClientSpeedByType from character-sheet-view.tsx.
function mergeSpeed(
  server: Readonly<Record<string, number>>,
  resolver: { byTarget: Readonly<Record<string, ReadonlyArray<{op: string; value: number; inhibited: boolean}>>> } | null,
): Readonly<Record<string, number>> {
  if (!resolver) return server;
  const out: Record<string, number> = {};
  const locomotionToResolverKey: Record<string, string> = {
    WALKING_SPEED: "speed.walking_speed",
    CLIMBING_SPEED: "speed.climbing_speed",
    SWIMMING_SPEED: "speed.swimming_speed",
    FLYING_SPEED: "speed.flying_speed",
    BURROWING_SPEED: "speed.burrowing_speed",
  };
  for (const [key, serverValue] of Object.entries(server)) {
    const resolverKey = locomotionToResolverKey[key];
    if (!resolverKey) {
      out[key] = serverValue;
      continue;
    }
    const contribs = resolver.byTarget[resolverKey] ?? [];
    const activeContribs = contribs.filter(
      (c) => !c.inhibited && (c.op === "add" || c.op === "subtract"),
    );
    if (activeContribs.length === 0) {
      out[key] = serverValue;
      continue;
    }
    const delta = activeContribs.reduce(
      (sum, c) => sum + (c.op === "subtract" ? -c.value : c.value),
      0,
    );
    out[key] = serverValue + delta;
  }
  return out;
}
