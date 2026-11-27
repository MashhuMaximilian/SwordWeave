import { AsyncLocalStorage } from "node:async_hooks";
import { getMcpConfig, type McpConfig } from "./config";

const activeConfig = new AsyncLocalStorage<McpConfig>();

export function withMcpRequestConfig<T>(config: McpConfig, work: () => T): T {
  return activeConfig.run(config, work);
}

export function getMcpRequestConfig(): McpConfig | null {
  return activeConfig.getStore() ?? getMcpConfig();
}
