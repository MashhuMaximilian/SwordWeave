import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, withDatabaseTransaction } from "@/db/client";
import { characters } from "@/db/schema";
import { consequenceMutationSchema } from "@/lib/character/consequences/validation";
import { ConsequenceCommandError, readCharacterConsequences, saveCharacterConsequences } from "@/lib/character/consequences/mutations";
import { bustResolverCache } from "@/lib/cache/character-resolver-cache";
import { resolveCharacterAccess } from "@/lib/character/resolve-character-access";

function failure(error: unknown) {
  return NextResponse.json(
    { error: error instanceof Error ? error.message : "Consequence save failed." },
    { status: error instanceof ConsequenceCommandError ? error.status : 400 },
  );
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth.protect();
    const { id } = await params;
    await resolveCharacterAccess(userId, id, { require: "OWNER" });
    return NextResponse.json(await readCharacterConsequences(id));
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth.protect();
    const { id } = await params;
    const body = consequenceMutationSchema.parse(await request.json());
    await resolveCharacterAccess(userId, id, { require: "OWNER" });
    const result = await withDatabaseTransaction(async () => {
      const [locked] = await db.select({ id: characters.id }).from(characters).where(eq(characters.id, id)).for("update");
      if (!locked) throw new ConsequenceCommandError("Character not found.", 404);
      await resolveCharacterAccess(userId, id, { require: "OWNER" });
      return saveCharacterConsequences(id, body);
    });
    bustResolverCache(id);
    return NextResponse.json(result);
  } catch (error) {
    return failure(error);
  }
}
