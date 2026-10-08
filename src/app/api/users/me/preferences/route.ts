import { auth, currentUser } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { users } from "@/db/schema/profiles";
import { resolveLocalAuthorIdentity } from "@/lib/auth/author-resolver";
import { privateJson } from "@/lib/http/private-json";
import { readBoundedJson } from "@/lib/http/read-bounded-json";
export async function PATCH(request: Request) {
  const { userId } = await auth();
  if (!userId) return privateJson({ error: "Sign in first." }, { status: 401 });
  try {
    const identity = await resolveLocalAuthorIdentity(
      userId,
      (await currentUser())?.username,
    );
    const data = z
      .object({ isGameMaster: z.boolean() })
      .strict()
      .parse(await readBoundedJson(request, 1024));
    const [row] = await db
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.clerkUserId, identity.clerkUserId))
      .returning({ isGameMaster: users.isGameMaster });
    return row
      ? privateJson(row)
      : privateJson({ error: "Profile not found." }, { status: 404 });
  } catch {
    return privateJson({ error: "Invalid preference." }, { status: 400 });
  }
}
