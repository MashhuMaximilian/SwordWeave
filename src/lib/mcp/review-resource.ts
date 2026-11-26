import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { registerAppResource, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { markdownDocument } from "@/components/ui/markdown";
import { BACKSTORY_FIELDS } from "@/lib/character/character-backstory";
import type { CharacterCreationPreview } from "./proposal";

const uri = "ui://swordweave/character-review-v1.html";

export const characterReviewToolMeta = {
  ui: { resourceUri: uri, visibility: ["model"] },
  "openai/outputTemplate": uri,
};

export function registerCharacterReviewResource(server: McpServer, resourceUrl: string) {
  const domain = new URL(resourceUrl).origin;
  registerAppResource(server, "SwordWeave character preview", uri, {}, async () => ({
    contents: [{
      uri,
      mimeType: RESOURCE_MIME_TYPE,
      text: await readFile(join(process.cwd(), "src/lib/mcp/widgets/character-review.html"), "utf8"),
      _meta: { ui: { domain, prefersBorder: true, csp: { connectDomains: [], resourceDomains: [] } } },
    }],
  }));
}

export function characterReviewResultMeta(preview: CharacterCreationPreview) {
  return {
    "swordweave/drawbacks": preview.normalized.placements.flatMap(({ name, drawback, mirrorCredit }) => drawback ? [{
      label: `${name} · ${mirrorCredit} BU credit`, mechanicalRule: drawback.description,
      blocks: markdownDocument(drawback.eligibilityNotes ?? ""),
    }] : []),
    "swordweave/backstory": BACKSTORY_FIELDS.flatMap(({ key, label }) => {
      const markdown = preview.normalized.backstory[key];
      return markdown?.trim() ? [{ label, blocks: markdownDocument(markdown) }] : [];
    }),
    "swordweave/authored-rules": preview.normalized.placements.flatMap(({ name, authored }) => authored ? [{
      label: name, mechanicalRule: authored.mechanicalOutputText, blocks: markdownDocument(authored.narrativeRule),
      ...(authored.forkedFrom ? { sourceName: authored.forkedFrom.name } : {}),
    }] : []),
    "swordweave/authored-capabilities": (preview.normalized.capabilities ?? []).flatMap(({ name, authored }) => authored ? [{
      label: name, mechanicalRule: `${authored.type.toLowerCase()} · ${authored.sourceType.toLowerCase()} · ${authored.componentBu} BU in this capability`,
      blocks: markdownDocument(authored.verboseDescription),
      ...(authored.forkedFrom ? { sourceName: authored.forkedFrom.name } : {}),
    }] : []),
  };
}
