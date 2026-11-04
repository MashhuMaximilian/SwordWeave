import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ send: vi.fn(), readFile: vi.fn(), getBlob: vi.fn() }));
vi.mock("node:fs", async importOriginal => ({
  ...await importOriginal<typeof import("node:fs")>(),
  readFileSync: mocks.readFile,
}));
vi.mock("@aws-sdk/client-s3", async importOriginal => ({
  ...await importOriginal<typeof import("@aws-sdk/client-s3")>(),
  S3Client: class { send = mocks.send; },
}));
vi.mock("@vercel/blob", () => ({ get: mocks.getBlob, put: vi.fn() }));

const key = "user-uploads/owner/portrait.png";
const alias = `https://swordweave-example.private.blob.vercel-storage.com/${key}`;
const manifest = Buffer.from(JSON.stringify({
  schemaVersion: 1, createdAt: "2026-11-04T00:00:00.000Z",
  inventorySha256: "a".repeat(64), aliases: [{ unsignedUrl: alias, key }],
}));

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  mocks.readFile.mockReturnValue(manifest);
  vi.stubEnv("SW_HOSTING", "hetzner");
  vi.stubEnv("SW_UPLOAD_BACKEND", "r2");
  vi.stubEnv("SW_UPLOAD_ALIAS_FILE", "/app/config/upload-aliases.json");
  vi.stubEnv("SW_UPLOAD_INVENTORY_SHA256", "a".repeat(64));
  vi.stubEnv("SW_UPLOAD_ALIAS_SHA256", createHash("sha256").update(manifest).digest("hex"));
  vi.stubEnv("SW_R2_ENDPOINT", `https://${"a".repeat(32)}.r2.cloudflarestorage.com`);
  vi.stubEnv("SW_R2_UPLOAD_BUCKET", "isolated-uploads");
  vi.stubEnv("SW_R2_ACCESS_KEY_ID", "unit-test");
  vi.stubEnv("SW_R2_SECRET_ACCESS_KEY", "unit-test");
});

afterEach(() => vi.unstubAllEnvs());

describe("private upload migration", () => {
  it("normalizes a signed legacy URL without sending its signature to the client", async () => {
    const { displayArtworkUrl, uploadKey } = await import("../upload-path");
    expect(displayArtworkUrl(alias + "?signature=old")).toBe(`/api/icons/blob/${key}`);
    expect(uploadKey(alias.replace("/user-uploads/", "/other/../user-uploads/"))).toBeNull();
    expect(uploadKey("https://outside.example/" + key)).toBeNull();
  });

  it("rejects an alias file with a different independently selected inventory digest", async () => {
    vi.stubEnv("SW_UPLOAD_INVENTORY_SHA256", "b".repeat(64));
    const { readPrivateUpload } = await import("../private-upload-store");
    await expect(readPrivateUpload(key)).rejects.toThrow("upload binding is invalid");
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.getBlob).not.toHaveBeenCalled();
  });

  it("streams the exact bytes and uses a conditional put to protect existing uploads", async () => {
    const { readPrivateUpload, writePrivateUpload } = await import("../private-upload-store");
    mocks.send.mockResolvedValueOnce({
      Body: { transformToWebStream: () => new Response(new Uint8Array([1, 2, 3])).body! },
      ContentLength: 3,
    }).mockResolvedValueOnce({});
    const upload = await readPrivateUpload(key);
    expect(new Uint8Array(await new Response(upload?.stream).arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
    await writePrivateUpload(key, new File([new Uint8Array([1, 2, 3])], "portrait.png", { type: "image/png" }), new AbortController().signal);
    expect(mocks.send.mock.calls[1]?.[0].input).toMatchObject({
      Bucket: "isolated-uploads", Key: key, ContentLength: 3, ContentType: "image/png", IfNoneMatch: "*",
    });
  });
});
