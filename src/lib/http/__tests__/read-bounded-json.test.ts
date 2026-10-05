import { describe, expect, it } from "vitest";
import { readBoundedJson, RequestSizeError } from "../read-bounded-json";
const req = (body: string, headers?: Record<string,string>) => new Request("https://test.invalid", { method: "POST", body, ...(headers ? { headers } : {}) });
describe("bounded request JSON", () => {
  it("accepts valid JSON without a length hint", async () => {
    expect(await readBoundedJson(req('{"name":"é"}'), 20)).toEqual({ name: "é" });
  });
  it("bounds encoded bytes rather than character count", async () => {
    await expect(readBoundedJson(req('"ééé"'), 7)).rejects.toBeInstanceOf(RequestSizeError);
  });
  it("rejects oversized length hints before parsing", async () => {
    await expect(readBoundedJson(req('{}', { "content-length": "200" }), 20)).rejects.toBeInstanceOf(RequestSizeError);
  });
  it("preserves JSON syntax errors", async () => {
    await expect(readBoundedJson(req('{'))).rejects.toBeInstanceOf(SyntaxError);
  });
});
