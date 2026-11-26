import { MonsterPlaySheet } from "@/components/monsters/monster-play-sheet";

export default async function Page({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ character?: string }>;
}) {
  const [{ id }, { character }] = await Promise.all([params, searchParams]);
  const returnCharacterId = character && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(character) ? character : undefined;
  return <MonsterPlaySheet id={id} {...(returnCharacterId ? { returnCharacterId } : {})} />;
}
