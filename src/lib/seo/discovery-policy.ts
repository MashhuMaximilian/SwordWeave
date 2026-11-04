import "server-only";
import { deploymentMode } from "@/lib/runtime/deployment";

export function isDiscoveryProduction(): boolean {
  return deploymentMode() === "production" && process.env["VERCEL_ENV"] !== "preview" && process.env.NODE_ENV !== "development";
}
