import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { cloneCharacter } from "@/lib/character/clone-character";

/** Clone from the sheet link, then open the caller's private copy. */
export default async function CloneCharacterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { userId } = await auth.protect();
  const { id } = await params;
  const character = await cloneCharacter(id, userId);
  redirect(character ? `/characters/${character.id}` : "/characters");
}
