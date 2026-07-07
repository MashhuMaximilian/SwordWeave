import { describe, expect, it } from "vitest";
import { computeUniqueForkName, FORK_SUFFIX } from "../fork-naming";

describe("computeUniqueForkName", () => {
  it("returns the bare ' (fork)' suffix when no collision", async () => {
    const exists = () => false;
    const name = await computeUniqueForkName("Strike", exists);
    expect(name).toBe(`Strike${FORK_SUFFIX}`);
  });

  it("walks numeric suffixes on collision", async () => {
    const taken = new Set([`Strike${FORK_SUFFIX}`]);
    const exists = (c: string) => taken.has(c);
    const name = await computeUniqueForkName("Strike", exists);
    expect(name).toBe(`Strike${FORK_SUFFIX} 2`);
  });

  it("skips multiple collisions in a row", async () => {
    const taken = new Set([
      `Strike${FORK_SUFFIX}`,
      `Strike${FORK_SUFFIX} 2`,
      `Strike${FORK_SUFFIX} 3`,
    ]);
    const exists = (c: string) => taken.has(c);
    const name = await computeUniqueForkName("Strike", exists);
    expect(name).toBe(`Strike${FORK_SUFFIX} 4`);
  });

  it("handles async predicates", async () => {
    const taken = new Set([`Strike${FORK_SUFFIX}`]);
    const exists = async (c: string) => taken.has(c);
    const name = await computeUniqueForkName("Strike", exists);
    expect(name).toBe(`Strike${FORK_SUFFIX} 2`);
  });

  it("falls back to UUID suffix when exhausted", async () => {
    // Pretend every numeric slot is taken. The helper should bail to a UUID.
    const exists = () => true;
    const name = await computeUniqueForkName("Strike", exists);
    expect(name.startsWith(`Strike${FORK_SUFFIX} `)).toBe(true);
    // The fallback is `${baseName}${FORK_SUFFIX} ${randomUUID().slice(0, 8)}`,
    // so the trailing token is exactly 8 hex chars (with possible dashes
    // stripped from the UUID slice).
    const lastToken = name.split(" ").pop() ?? "";
    expect(lastToken).toMatch(/^[a-f0-9-]+$/i);
  });
});
