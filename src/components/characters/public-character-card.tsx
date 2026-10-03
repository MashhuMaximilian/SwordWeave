import Link from "next/link";
import { Swords } from "lucide-react";
import { ForkCharacterButton } from "@/components/characters/fork-character-button";
import { RosterCharacterCard, type RosterCharacter } from "./roster-character-card";
import type { LibraryItem } from "@/lib/publishing/library-query";

export function PublicCharacterCard({ item, character }: { item: LibraryItem; character: RosterCharacter }) {
  const author = !item.authorId || item.authorIsAdmin
    ? "System"
    : item.authorDisplayName ?? item.authorUsername ?? "Unknown author";
  return <RosterCharacterCard character={character}
    attribution={<><span>By {author}</span>{(item.likesCount > 0 || item.forkCount > 0) && <span>♥ {item.likesCount} · ⑂ {item.forkCount}</span>}</>}
    actions={<><Link href={`/characters/${item.targetId}?view=public`} className="v12-roster-open"><Swords aria-hidden="true" />Open sheet</Link><ForkCharacterButton characterId={item.targetId} roster /></>}
  />;
}
