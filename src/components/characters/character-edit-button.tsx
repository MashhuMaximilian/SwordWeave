"use client";
import { usePathname, useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { openCharacterEditor, type CharacterEditorIntent } from "./workspace/editor-events";

export interface CharacterEditButtonProps {
  readonly characterId: string;
  readonly className?: string;
  readonly title?: string;
  readonly label?: string;
  readonly intent?: CharacterEditorIntent;
}
/** Every edit entry resumes the character's own draft workspace; no Atelier route or legacy modal. */
export function CharacterEditButton({ characterId, className, title = "Edit this character here", label = "Edit character", intent = "concept" }: CharacterEditButtonProps) {
  const router = useRouter();
  const pathname = usePathname();
  return <button type="button" title={title} className={className ?? "flex items-center justify-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-card"} onClick={() => {
    if (pathname === `/characters/${characterId}`) openCharacterEditor(characterId,intent);
    else router.push(`/characters/${characterId}?edit=1&intent=${intent}`);
  }}><Pencil className="size-3.5"/>{label}</button>;
}
