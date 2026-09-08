import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  values: vi.fn(),
  auth: vi.fn(async () => ({ userId: "creator" })),
}));
vi.mock("@clerk/nextjs/server", () => ({ auth: { protect: mocks.auth } }));
vi.mock("@/lib/auth/author-resolver", () => ({
  resolveUserIdByClerkId: vi.fn(async () => "internal-id"),
}));
vi.mock("@/lib/publishing/auto-publish", () => ({
  autoPublishOnCreate: vi.fn(),
}));
vi.mock("@/lib/publishing/hash-content", () => ({
  buildCanonicalTemplatePayload: vi.fn(() => ({})),
  computeTemplateContentHash: vi.fn(async () => "hash"),
}));
vi.mock("@/lib/versions/auto-snapshot", () => ({ recordVersion: vi.fn() }));
vi.mock("@/db/client", () => ({
  db: {
    transaction: async (fn: (tx: unknown) => unknown) =>
      fn({
        insert: () => ({
          values: (v: unknown) => {
            mocks.values(v);
            return { returning: async () => [{ id: "new-id" }] };
          },
        }),
        query: {
          heritage: {
            findFirst: async () => ({
              id: "new-id",
              kind: "MANIFEST",
              name: "Mine",
              isPublic: false,
            }),
          },
        },
      }),
    update: () => ({ set: () => ({ where: async () => undefined }) }),
  },
}));
import { POST } from "../route";
beforeEach(() => vi.clearAllMocks());
it("records the authenticated creator and ignores a client-supplied owner", async () => {
  const response = await POST(
    new Request("http://localhost/api/heritage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "MANIFEST",
        name: "Mine",
        userId: "someone-else",
        primitiveIds: [],
      }),
    }),
  );
  expect(response.status).toBe(201);
  expect(mocks.values.mock.calls[0]?.[0]).toMatchObject({
    userId: "creator",
    name: "Mine",
    kind: "MANIFEST",
  });
});

vi.mock("@/lib/publishing/save-transaction", () => ({withPublishingResponse: (work:()=>Promise<unknown>)=>work()}));
