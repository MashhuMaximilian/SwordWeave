import { z } from "zod";

const neonHost = z.string().regex(/^ep-[a-z0-9-]+\.(?:[a-z0-9-]+\.)+neon\.tech$/);
const databaseName = z.string().regex(/^[a-zA-Z0-9_-]+$/);
const branch = z.object({
  projectId: z.string().min(1),
  branchId: z.string().regex(/^br-[a-z0-9-]+$/),
  databaseName,
}).strict();

export const applicationTestTargetV1 = z.object({
  schemaVersion: z.literal(1),
  purpose: z.literal("application-tests"),
  approvalRef: z.string().min(1),
  sourceRevision: z.string().regex(/^[0-9a-f]{40}$/),
  production: branch.extend({ endpointHosts: z.array(neonHost).nonempty() }),
  test: branch.extend({ endpointHost: neonHost }),
  connectionEnv: z.literal("SW_TEST_DATABASE_URL"),
}).strict().refine(({ production, test }) =>
  test.branchId !== production.branchId &&
  !production.endpointHosts.some(host =>
    host.replace(/-pooler\./, ".") === test.endpointHost.replace(/-pooler\./, ".")
  )
);

export type ApplicationTestTargetV1 = z.infer<typeof applicationTestTargetV1>;

export function assertTestDatabaseUrl(target: ApplicationTestTargetV1, raw: string | undefined): string {
  let url: URL;
  try {
    url = new URL(raw ?? "");
  } catch {
    throw new Error("The isolated test database URL is missing or invalid.");
  }

  const params = url.searchParams;
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    url.hostname !== target.test.endpointHost ||
    url.pathname !== `/${target.test.databaseName}` ||
    (url.port !== "" && url.port !== "5432") ||
    !url.username || !url.password || url.hash ||
    !["require", "verify-full"].includes(params.get("sslmode") ?? "") ||
    [...params.keys()].some(key =>
      params.getAll(key).length !== 1 || !["sslmode", "channel_binding"].includes(key)
    ) ||
    (params.has("channel_binding") && params.get("channel_binding") !== "require")
  ) {
    throw new Error("The connection does not match the approved isolated database target.");
  }
  return raw!;
}
