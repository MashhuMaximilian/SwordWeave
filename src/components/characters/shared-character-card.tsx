import Link from "next/link";
import { ArrowRight, Eye, Pencil } from "lucide-react";
import { RosterCharacterCard, type RosterCharacter } from "./roster-character-card";
import type { SharedCharacterRow } from "@/lib/character/list-shared-characters";

export function SharedCharacterCard({ row, character }: { row: SharedCharacterRow; character: RosterCharacter }) {
  return <RosterCharacterCard character={character}
    attribution={<><span>Shared by {row.grantedByDisplayName ?? row.grantedByUsername ?? "Unknown user"}</span><span className="v12-roster-permission">{row.canEdit ? <Pencil aria-hidden="true" /> : <Eye aria-hidden="true" />}{row.canEdit ? "Can edit" : "View only"}</span></>}
    actions={<Link href={`/characters/${row.id}`} className="v12-roster-open">Open sheet <ArrowRight aria-hidden="true" /></Link>}
  />;
}
