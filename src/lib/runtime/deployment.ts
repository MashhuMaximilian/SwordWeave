import "server-only";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { z } from "zod";
import { legacyUploadAlias } from "@/lib/assets/upload-path";
import { modePolicy } from "./mode-policy";

const digest = z.string().regex(/^[0-9a-f]{64}$/);
const aliasesV1 = z.object({
  schemaVersion: z.literal(1),
  createdAt: z.iso.datetime(),
  inventorySha256: digest,
  aliases: z.array(z.object({ unsignedUrl: z.string(), key: z.string() }).strict()),
}).strict();
const mode = z.enum(["preview", "production", "restore"]);

let selectedAliases: ReadonlyMap<string, readonly string[]> | undefined;

export function deploymentMode(): z.infer<typeof mode> {
  const value = process.env["SW_DEPLOYMENT_MODE"];
  if (value === undefined && process.env["SW_HOSTING"] !== "hetzner") return "production";
  const parsed = mode.safeParse(value);
  if (!parsed.success) throw new Error("SwordWeave deployment configuration is invalid.");
  return parsed.data;
}

export function deploymentPolicy() {
  return modePolicy(deploymentMode(), process.env["SW_OPERATIONAL_NOTICES_ENABLED"] === "true");
}

export function verifiedUploadAliases(): ReadonlyMap<string, readonly string[]> {
  if (process.env["SW_HOSTING"] !== "hetzner" && process.env["SW_UPLOAD_BACKEND"] !== "r2") return new Map();
  if (selectedAliases) return selectedAliases;
  try {
    const expectedAlias = digest.parse(process.env["SW_UPLOAD_ALIAS_SHA256"]);
    const expectedInventory = digest.parse(process.env["SW_UPLOAD_INVENTORY_SHA256"]);
    const file = z.string().startsWith("/").parse(process.env["SW_UPLOAD_ALIAS_FILE"]);
    const bytes = readFileSync(file);
    if (createHash("sha256").update(bytes).digest("hex") !== expectedAlias) throw new Error();
    const manifest = aliasesV1.parse(JSON.parse(bytes.toString("utf8")));
    if (manifest.inventorySha256 !== expectedInventory) throw new Error();

    const seen = new Set<string>();
    const byKey = new Map<string, string[]>();
    for (const { unsignedUrl, key } of manifest.aliases) {
      const parsed = legacyUploadAlias(unsignedUrl);
      if (!parsed || parsed.unsignedUrl !== unsignedUrl || parsed.key !== key || seen.has(unsignedUrl)) throw new Error();
      seen.add(unsignedUrl);
      const values = byKey.get(key) ?? [];
      values.push(unsignedUrl);
      byKey.set(key, values);
    }
    selectedAliases = byKey;
    return byKey;
  } catch {
    throw new Error("SwordWeave upload binding is invalid.");
  }
}
