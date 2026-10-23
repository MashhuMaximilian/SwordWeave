import type { CharacterBackstory } from "@/lib/character/character-backstory";
import type { CharacterPermission } from "@/lib/character/permission-policy";
import type { WorkspaceGraph } from "@/lib/character/workspace/model";
import type { CharacterSheet } from "@/lib/engine/sheet";

export type CharacterPdfRecord = Record<string, unknown>;

export interface CharacterPdfImage {
  data: string;
  mimeType: "image/png";
  width: number;
  height: number;
  author?: string;
  source?: string;
  license?: string;
  licenseUrl?: string;
  credit?: string;
}
export interface CharacterPdfMedia {
  character?: CharacterPdfImage;
  heritages: Record<string, CharacterPdfImage>;
  icons: Record<string, CharacterPdfImage>;
  warnings: string[];
}

export interface CharacterPdfPrimitiveLink extends CharacterPdfRecord {
  instanceId?: string;
  primitiveId: number;
  isMirrored: boolean;
  primitive: CharacterPdfRecord & {
    id: number;
    name: string;
    mechanicalOutputText: string;
    originalMechanicalOutputText: string;
    narrativeRule: string;
  };
}

export interface CharacterPdfPractice {
  practice: string;
  attribute: string;
  total: number;
  slice: number;
  pbContribution: number;
  training: 0 | 1 | 2;
  primitiveContributions: CharacterSheet["practices"][number]["primitiveContributions"];
}

/** A server-resolved, serializable snapshot. No client-supplied character data
 * or private DM notes enter the renderer. Legacy publication generators use
 * these same character/primitiveLinks/readOnlyGraph property names. */
export interface CharacterPdfSnapshot extends CharacterPdfRecord {
  pdfMedia?: CharacterPdfMedia;
  id: string;
  name: string;
  level: number;
  size: string;
  notes: string | null;
  dmNotes: null;
  viewerPermission: CharacterPermission;
  primitiveLinks: CharacterPdfPrimitiveLink[];
  capabilityLinks: CharacterPdfRecord[];
  effectLinks: CharacterPdfRecord[];
  itemLinks: CharacterPdfRecord[];
  heritageLinks: CharacterPdfRecord[];
  readOnlyGraph: WorkspaceGraph;
  readOnlyConditions: unknown[];
  backstory: CharacterBackstory;
  practices: CharacterPdfPractice[];
  vitality: CharacterSheet["vitality"];
  encumbrance: CharacterSheet["encumbrance"];
  buBalance: CharacterSheet["buBalance"];
  volatility: CharacterSheet["volatility"];
  conditionContext: {
    character: {
      attributes: CharacterSheet["attributes"];
      practices: Record<string, number>;
      vitality: number;
      vitalityMax: number;
      saveDc: number;
      proficiencies: string[];
      flags: string[];
      custom: Record<string, number>;
    };
  };
  pdfDerived: {
    attributes: CharacterSheet["attributes"];
    saves: { physical: number; mental: number; magical: number };
    practices: CharacterPdfPractice[];
    pb: number;
    dc: number;
    movement: { walk: number; climb: number; swim: number; fly: number; burrow: number };
    restCap: number;
    slotCapacity: number;
    carryCapacity: number;
    equippedSlotsUsed: number;
    currentLoad: number;
  };
}
