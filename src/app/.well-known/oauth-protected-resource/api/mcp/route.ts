import { getMcpConfig } from "@/lib/mcp/config";
import { protectedResourceMetadata, protectedResourceOptions } from "@/lib/mcp/resource-metadata";

export const dynamic = "force-dynamic";

export function GET(): Response {
  return protectedResourceMetadata(getMcpConfig());
}

export function OPTIONS(): Response {
  return protectedResourceOptions();
}
