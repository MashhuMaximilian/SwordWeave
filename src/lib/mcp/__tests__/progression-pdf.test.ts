import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { GET } from "@/app/api/companion/progression/[documentId]/route";
import { playerNotesDigest, projectApprovedNoteAppend } from "@/lib/character/append-approved-note";
import { OperationUnavailableError } from "../operations";
import { progressionNoteMarkdown } from "../progression-note";

const fixture = vi.hoisted(() => ({ actor: vi.fn(), load: vi.fn(), render: vi.fn() }));
vi.mock("../browser-approval", () => ({ resolveCompanionBrowserActor: fixture.actor }));
vi.mock("../operations", async load => ({ ...await load<typeof import("../operations")>(), getApprovedProgressionDocument: fixture.load }));
vi.mock("@/lib/character-pdf/render", async load => ({ ...await load<typeof import("@/lib/character-pdf/render")>(), renderProgressionPdf: fixture.render }));

const documentId = "aa5a0977-2e86-48bc-9c9e-db2bb93b8f14";
const actor = { id: "a51e810a-cdb1-4c08-a9d4-0afa3632b3b6", clerkId: "user_fixture", scopes: [] };
const plan = { title: "Aster and the Storm", ideas: ["Use **Storm**.", "Look at Touch."] };
const request = () => new Request(`https://swordweave.test/api/companion/progression/${documentId}`);
const params = { params: Promise.resolve({ documentId }) };

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("MCP_READ_ENABLED", "true");
  vi.stubEnv("MCP_RESOURCE_URL", "https://swordweave.test/api/mcp");
  vi.stubEnv("MCP_CLERK_ISSUER", "https://clerk.swordweave.test");
  fixture.actor.mockResolvedValue(actor);
  fixture.render.mockResolvedValue(Buffer.from("%PDF-test"));
});
afterEach(() => vi.unstubAllEnvs());

it("downloads the exact approved plan with a private attachment response", async () => {
  fixture.load.mockResolvedValue(plan);
  const response = await GET(request(), params);
  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(response.headers.get("Content-Disposition")).toMatch(/^attachment;/);
  expect(await response.text()).toMatch(/^%PDF-/);
  expect(fixture.load).toHaveBeenCalledWith(actor, documentId, "browser");
  expect(fixture.render).toHaveBeenCalledWith(plan, expect.any(AbortSignal));
});

it("returns unavailable before rendering when the signed-in player cannot open the plan", async () => {
  fixture.load.mockRejectedValue(new OperationUnavailableError());
  expect((await GET(request(), params)).status).toBe(404);
  expect(fixture.render).not.toHaveBeenCalled();
  fixture.actor.mockResolvedValue(null);
  fixture.load.mockClear();
  expect((await GET(request(), params)).status).toBe(404);
  expect(fixture.load).not.toHaveBeenCalled();
});

it.each([[null, ""], ["Original é", "\n\n"], ["Original\n", "\n"], ["Original\n\n", ""], ["Original\r\n\r\n", ""]] as const)(
  "preserves the existing Player Notes bytes for %s", (original, separator) => {
    const content = progressionNoteMarkdown(plan);
    expect(content).toContain("Use **Storm**.");
    expect(projectApprovedNoteAppend(original, content)).toEqual({ notes: (original ?? "") + separator + content, separator, addition: separator + content });
    expect(playerNotesDigest(original)).toBe(playerNotesDigest(original ?? ""));
  },
);
