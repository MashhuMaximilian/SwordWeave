export const MAX_CHARACTER_COMPANIONS = 20;

export function characterCompanionsPath(characterId: string) {
  return `/characters/${encodeURIComponent(characterId)}?section=companions`;
}

export function characterCompanionPlayPath(copyId: string, characterId: string) {
  return `/monsters/play/${encodeURIComponent(copyId)}?character=${encodeURIComponent(characterId)}`;
}

export function characterCompanionBestiaryPath(templateId: string, version: number) {
  return `/monsters/${encodeURIComponent(templateId)}?version=${version}`;
}

export interface CharacterCompanionCandidate {
  id: string;
  name: string;
  version: number;
}

export interface CharacterCompanionPickerEntry extends CharacterCompanionCandidate {
  description: string;
  imageUrl: string | null;
  size: string;
  vitality: number;
  budget: number;
}

export interface CharacterCompanionPickerPage {
  candidates: CharacterCompanionPickerEntry[];
  nextOffset: number | null;
}

export interface CharacterCompanionSummary {
  id: string;
  name: string;
  playCopyId?: string;
  bestiary?: CharacterCompanionCandidate;
}

export type CharacterCompanionAction =
  | { action: "add"; templateId: string; version: number; name?: string }
  | { action: "remove"; attachmentId: string };

export interface CharacterCompanionChange {
  id: string;
  action: CharacterCompanionAction["action"];
  name: string;
}

/** Private metadata stored in the owner's applied draft receipt for Undo. */
export interface CharacterCompanionAttachmentRecord {
  id: string;
  copyId: string;
  position: number;
}
