import { afterEach, describe, expect, it, vi } from "vitest";
import { webcrypto } from "node:crypto";
import { browserUuid } from "../browser-uuid";

afterEach(() => vi.unstubAllGlobals());

describe("browserUuid on a local HTTP network", () => {
  it("creates valid unique v4 request IDs when randomUUID is unavailable", () => {
    vi.stubGlobal("crypto", { getRandomValues: webcrypto.getRandomValues.bind(webcrypto) });
    const ids = Array.from({ length: 100 }, () => browserUuid());
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
  it("keeps the browser implementation in a secure context", () => {
    const randomUUID = vi.fn(() => "00000000-0000-4000-8000-000000000000");
    vi.stubGlobal("crypto", { randomUUID });
    expect(browserUuid()).toBe("00000000-0000-4000-8000-000000000000");
    expect(randomUUID).toHaveBeenCalledOnce();
  });
});
