import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { expect, it } from "vitest";
import { markdownDocument } from "@/components/ui/markdown";
import { characterReviewToolMeta, registerCharacterReviewResource } from "../review-resource";

it("serves a versioned read-only MCP Apps resource with no external resource permissions", async () => {
  const sdk = new McpServer({ name: "swordweave-preview-test", version: "1.0.0" });
  const client = new Client({ name: "fixture", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  registerCharacterReviewResource(sdk, "https://fictional.example/api/mcp");
  await sdk.connect(serverTransport);
  await client.connect(clientTransport);
  try {
    const resource = await client.readResource({ uri: characterReviewToolMeta.ui.resourceUri });
    expect(resource.contents[0]).toMatchObject({
      mimeType: RESOURCE_MIME_TYPE,
      text: expect.stringContaining("ui/notifications/tool-result"),
      _meta: { ui: { domain: "https://fictional.example", csp: { resourceDomains: [], connectDomains: [] } } },
    });
    expect(characterReviewToolMeta.ui.visibility).toEqual(["model"]);
  } finally {
    await client.close();
    await sdk.close();
  }
});

it("uses the shared Markdown renderer's formatting tokens and strips navigation metadata", () => {
  expect(markdownDocument("**Courier**\n\n- *Storm*\n- <img onerror=alert(1)>\n\n[private](https://fictional.example/path)")).toEqual([
    { type: "p", items: [[{ tag: "strong", text: "Courier" }]] },
    { type: "ul", items: [[{ tag: "em", text: "Storm" }], [{ tag: "text", text: "<img onerror=alert(1)>" }]] },
    { type: "p", items: [[{ tag: "text", text: "private" }]] },
  ]);
});
