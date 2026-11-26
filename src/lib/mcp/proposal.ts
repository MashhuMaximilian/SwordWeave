import { planCreation, type CharacterCreationPreview, type PinnedCharacterCreation } from "@/lib/character/prepare-creation";
import type { McpActor } from "./auth";
import type { DraftV1 } from "./draft";

export { draftV1, previewCharacterInput, type DraftV1 } from "./draft";
export { CharacterPrimitiveConflictError } from "./creation-authoring";
export { CharacterCapabilityConflictError } from "@/lib/character/creation-capability";
export {
  assertPinnedCreationReviewCurrent,
  creationStepKinds,
  performPinnedCharacterCreationStep,
  persistApprovedPinnedCharacterCreation,
  StaleCharacterCreationError,
} from "@/lib/character/persist-creation";
export type { CharacterCreationPreview, PinnedCharacterCreation } from "@/lib/character/prepare-creation";

type CreationActor = Pick<McpActor, "id" | "clerkId">;

export async function previewCharacter(draft: DraftV1, actor: CreationActor): Promise<CharacterCreationPreview> {
  return (await planCreation(draft, actor)).preview;
}

export async function preparePinnedCharacterCreation(draft: DraftV1, actor: CreationActor): Promise<{
  preview: CharacterCreationPreview;
  prepared: PinnedCharacterCreation | null;
}> {
  const { preview, prepared } = await planCreation(draft, actor);
  return { preview, prepared };
}
