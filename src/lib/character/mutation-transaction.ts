import { eq } from "drizzle-orm";
import { db, withDatabaseTransaction } from "@/db/client";
import { characters } from "@/db/schema";
class RejectedCharacterMutation<T extends Response> extends Error {
  constructor(readonly response: T) {
    super("Character mutation rejected");
  }
}
export async function withCharacterMutation<T extends Response>(
  id: string,
  work: () => Promise<T>,
): Promise<T> {
  try {
    return await withDatabaseTransaction(async () => {
      await db
        .select({ id: characters.id })
        .from(characters)
        .where(eq(characters.id, id))
        .for("update");
      const response = await work();
      if (!response.ok) throw new RejectedCharacterMutation(response);
      return response;
    });
  } catch (error) {
    if (error instanceof RejectedCharacterMutation) return error.response as T;
    throw error;
  }
}
