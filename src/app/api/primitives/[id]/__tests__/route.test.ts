/**
 * Phase 8.3e (Mashu 2026-07-27): smoke test for the primitive
 * detail endpoint. The endpoint itself is hard to test in a
 * node environment (it touches the DB), but we test the
 * response shape contract by importing the handler and
 * verifying it parses its URL param correctly.
 *
 * This is a minimal sanity check; the full endpoint coverage
 * lives in src/db/__tests__/.
 */
import { describe, expect, it } from "vitest";

import { GET } from "../route";

describe("/api/primitives/[id] route — Phase 8.3e", () => {
  it("exports a GET handler", () => {
    expect(typeof GET).toBe("function");
  });

  it("rejects non-numeric ids with 400", async () => {
    // Use a fake Request — the handler only reads params, not
    // the request body, so any Request will do.
    const res = await GET(new Request("http://localhost/"), {
      // Bypass the DB call by passing a non-numeric id that
      // fails the parseInt check before the DB query.
      params: Promise.resolve({ id: "not-a-number" }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects zero or negative ids with 400", async () => {
    const res0 = await GET(new Request("http://localhost/"), {
      params: Promise.resolve({ id: "0" }),
    });
    expect(res0.status).toBe(400);

    const resNeg = await GET(new Request("http://localhost/"), {
      params: Promise.resolve({ id: "-5" }),
    });
    expect(resNeg.status).toBe(400);
  });
});