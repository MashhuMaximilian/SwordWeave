import { sql } from "drizzle-orm";
import { db, withDatabaseTransaction } from "@/db/client";

/** Entity endpoints and workspace commands share one transaction boundary.
 * The advisory lock serializes publication graphs, including nested fork saves,
 * before any source hash is read. Character locks still isolate gameplay edits.
 * This avoids opposite ancestor/child lock ordering during nested operations. */
export function withPublishingTransaction<T>(
  work: () => Promise<T>,
): Promise<T> {
  return withDatabaseTransaction(async () => {
    await db.execute(
      sql`select pg_advisory_xact_lock(hashtextextended('swordweave:publishing', 0))`,
    );
    return work();
  });
}

class RejectedSave<T extends Response> extends Error {
  constructor(readonly response: T) {
    super("Save rejected");
  }
}
/** Legacy handlers report errors as responses. Roll back before returning that
 * response, so validation failures cannot commit earlier writes. */
export async function withPublishingResponse<T extends Response>(
  work: () => Promise<T>,
): Promise<T> {
  try {
    return await withPublishingTransaction(async () => {
      const response = await work();
      if (!response.ok) throw new RejectedSave(response);
      return response;
    });
  } catch (error) {
    if (error instanceof RejectedSave) return error.response as T;
    throw error;
  }
}
