import { createHash } from "node:crypto";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { lexiconFamilies, primitives, primitiveVersions } from "@/db/schema";
import { creationBudget } from "@/lib/character/creation-budget";
import { creationDrawback } from "@/lib/character/creation-drawback";
import { loadCreationCapabilities, maxCreationCapabilityMembers, prepareCreationCapabilityFork, preparePrivateCreationCapability, type CreationCapability, type PreparedCreationCapability } from "@/lib/character/creation-capability";
import { adoptCreationPurchases, FREE_CREATION_FOUNDATIONS, missingCreationAccess, STARTER_CHARACTER_ATTRIBUTES } from "@/lib/character/creation-primitives";
import { parseBackstory } from "@/lib/character/character-backstory";
import { directPrimitivePinCondition } from "@/lib/character/direct-primitive-pin";
import { expandBundles, summarizeExpansionCost, type CharacterPrimitiveSource } from "@/lib/engine/bundle-expander";
import { canAcceptMirror, cumulativeBuForLevel, type PrimitiveInput } from "@/lib/engine/bu";
import { validateAttributes } from "@/lib/engine/practices";
import { authoredPrimitiveMatchesLive, prepareCharacterPrimitive, prepareCharacterPrimitiveFork, type PreparedCharacterPrimitive } from "@/lib/mcp/creation-authoring";
import { draftV1, type CreationDraftPiece, type DraftV1 } from "@/lib/mcp/draft";
import { canonicalJsonStringify } from "@/lib/publishing/hash-content";
import { visibilityCondition } from "@/lib/publishing/library-query";

const level = 1;
const startingBu = cumulativeBuForLevel(level);
const startingCategories = { verbTier: "VERB_TIER", domain: "DOMAIN", range: "RANGE", dieType: "INTENSITY_DICE" } as const;
type StartingAccess = keyof typeof startingCategories;
type AccessStatus = "selected" | "freeBaseline" | "missing";

type PrimitiveDefinition = PrimitiveInput & {
  id: number;
  category: typeof primitives.$inferSelect.category;
  hardModifiers: typeof primitives.$inferSelect.hardModifiers;
  versionId: string | null;
  snapshotDigest: string;
  snapshot?: Record<string, unknown>;
  sourceOrigin: string | null;
  freeFoundation: boolean;
  userId: string | null;
  authored?: PreparedCharacterPrimitive;
};

type CreationSlot = {
  pieceKey: string | null;
  primitive: PrimitiveDefinition;
  source: CharacterPrimitiveSource;
  isMirrored: boolean;
  drawback?: NonNullable<ReturnType<typeof creationDrawback>>;
  originCapabilityId?: string;
  originCapabilityPieceKey?: string;
  directSource?: CharacterPrimitiveSource;
};

type PlannedCapability = CreationCapability | (Pick<CreationCapability, "id" | "name" | "snapshotDigest"> & {
  versionId: null;
  authored: PreparedCreationCapability;
  members: PreparedCreationCapability["members"];
});
type CapabilitySlot = {
  pieceKey: string;
  capability: PlannedCapability;
  source: "LINEAGE" | "UPBRINGING" | "MANIFEST";
};

export type PinnedCharacterCreation = { draft: DraftV1; fingerprint: string };
export type CharacterCreationPreview = Awaited<ReturnType<typeof planCreation>>["preview"];

type ValidationError = { code: string; message: string; pieceKey?: string };

function digest(value: unknown): string {
  return createHash("sha256").update(canonicalJsonStringify(value)).digest("hex");
}

function checkDraftGraph(draft: DraftV1): ValidationError[] {
  const errors: ValidationError[] = [];
  const pieces = new Map<string, NonNullable<DraftV1["pieces"]>[number]>();
  for (const piece of draft.pieces ?? []) {
    if (pieces.has(piece.key)) errors.push({ code: "DUPLICATE_KEY", pieceKey: piece.key, message: "Each piece key must be unique." });
    pieces.set(piece.key, piece);
  }
  const adjacency = new Map<string, string[]>();
  for (const piece of pieces.values()) {
    if (piece.action === "reuse") continue;
    const kind = piece.action === "create" ? piece.kind : piece.from.kind;
    const edges: string[] = [];
    for (const member of piece.members ?? []) {
      const ref = member.ref;
      const target = "pieceKey" in ref ? pieces.get(ref.pieceKey) : undefined;
      const childKind = "pin" in ref ? ref.pin.kind : target?.action === "create" ? target.kind :
        target?.action === "reuse" ? target.pin.kind : target?.from.kind;
      if ("pieceKey" in ref) {
        if (!target) errors.push({ code: "MISSING_REFERENCE", pieceKey: piece.key, message: "A member references an unknown piece key." });
        else edges.push(ref.pieceKey);
      }
      const allowedChildren: Record<typeof kind, readonly string[]> = {
        primitive: [], effect: ["primitive"], capability: ["primitive", "effect"],
        heritage: ["primitive", "capability"], item: ["primitive", "capability", "effect"],
      };
      if (childKind && (!allowedChildren[kind].includes(childKind) ||
        (member.role !== undefined && (kind !== "capability" || childKind !== "primitive")) ||
        (member.isMirrored === true && childKind !== "primitive"))) {
        errors.push({ code: "INVALID_MEMBER", pieceKey: piece.key, message: "A member has an invalid kind, role or mirror flag." });
      }
    }
    adjacency.set(piece.key, edges);
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const cyclic = (key: string): boolean => {
    if (visiting.has(key)) return true;
    if (visited.has(key)) return false;
    visiting.add(key);
    const cycle = (adjacency.get(key) ?? []).some(cyclic);
    visiting.delete(key);
    visited.add(key);
    return cycle;
  };
  if ([...pieces.keys()].some(cyclic)) errors.push({ code: "DEPENDENCY_CYCLE", message: "Pieces must not depend on one another in a cycle." });
  return errors;
}

/** The first ready step in input order wins. The planner rejects cycles and unsupported pieces separately. */
export function orderedCreationAuthors(draft: DraftV1) {
  const pending = (draft.pieces ?? []).filter(piece =>
    (piece.action === "create" && (piece.kind === "primitive" || piece.kind === "capability")) ||
    (piece.action === "fork" && (piece.from.kind === "primitive" || piece.from.kind === "capability")));
  const remaining = new Set(pending.map(piece => piece.key));
  const ordered = [];
  while (pending.length) {
    const next = pending.findIndex(piece => piece.action === "reuse" ||
      (piece.members ?? []).every(({ ref }) => !("pieceKey" in ref) || !remaining.has(ref.pieceKey)));
    if (next < 0) break;
    const [piece] = pending.splice(next, 1);
    if (!piece || piece.action === "reuse") continue;
    remaining.delete(piece.key);
    const kind = (piece.action === "fork" ? piece.from.kind : piece.kind) === "primitive" ? "primitive" as const : "capability" as const;
    ordered.push({ key: piece.key, kind });
  }
  return ordered;
}

async function loadDefinitions(clerkId: string, ids: number[]) {
  const publicVisibility = visibilityCondition("PRIMITIVE", sql`${primitives.id}`, sql`${primitives.userId}`, undefined, sql`${primitives.isPublic}`);
  const foundationCondition = and(eq(primitives.buCost, 0), publicVisibility, or(
    ...FREE_CREATION_FOUNDATIONS.map(foundation => and(
      eq(primitives.name, foundation.name), eq(primitives.category, foundation.category),
      sql`(${primitives.id} = ${foundation.id} OR ${primitives.sourceOrigin} = 'SRD' OR ${primitives.userId} IS NULL)`,
    )),
  ));
  const rows = await db.select({
    id: primitives.id,
    name: primitives.name,
    category: primitives.category,
    buCost: primitives.buCost,
    isMirrorable: primitives.isMirrorable,
    mirrorBuCredit: primitives.mirrorBuCredit,
    hardModifiers: primitives.hardModifiers,
    freeFoundation: sql<boolean>`(${foundationCondition})`,
    userId: primitives.userId,
    sourceOrigin: primitives.sourceOrigin,
    versionId: primitiveVersions.id,
    snapshot: primitiveVersions.snapshot,
    forkSourceMatchesLive: sql<boolean>`${authoredPrimitiveMatchesLive}`,
  }).from(primitives).innerJoin(primitiveVersions, eq(primitiveVersions.primitiveId, primitives.id)).where(and(
    or(inArray(primitives.id, ids), foundationCondition),
    visibilityCondition("PRIMITIVE", sql`${primitives.id}`, sql`${primitives.userId}`, clerkId, sql`${primitives.isPublic}`),
    directPrimitivePinCondition,
  )).orderBy(primitives.id, primitiveVersions.versionNumber);
  return rows.map(row => ({ ...row, snapshotDigest: digest(row.snapshot) }));
}

export async function planCreation(input: DraftV1, actor: { id: string; clerkId: string }) {
  const parsed = draftV1.parse(input);
  const missing: string[] = [];
  const validationErrors = checkDraftGraph(parsed);
  const tableQuestions: string[] = [];
  const draft: DraftV1 = {
    schemaVersion: 1,
    name: parsed.name ?? "",
    attributes: parsed.attributes ?? STARTER_CHARACTER_ATTRIBUTES,
    size: parsed.size ?? "MEDIUM",
    pieces: parsed.pieces ?? [],
    placements: (parsed.placements ?? []).map(placement => ({ ...placement, isMirrored: placement.isMirrored ?? false })),
    backstory: parseBackstory(parsed.backstory),
  };

  if (!draft.name) missing.push("name");
  const { physical, mental, magical, proficient } = draft.attributes!;
  for (const [key, score] of Object.entries({ physical, mental, magical })) {
    if (score === undefined) missing.push(`attributes.${key}`);
  }
  if (physical !== undefined && mental !== undefined && magical !== undefined) {
    for (const message of validateAttributes({ physical, mental, magical }).errors) {
      validationErrors.push({ code: "INVALID_ATTRIBUTES", message });
    }
  }

  const reusable = new Map<string, { id: number; versionId: string }>();
  const forkSources = new Map<string, { id: number; versionId: string; changes: unknown }>();
  const reusableCapabilities = new Map<string, { id: string; versionId: string }>();
  const options = new Map<string, PrimitiveDefinition>();
  const authored: Array<
    { pieceKey: string; kind: "primitive"; recipe: PreparedCharacterPrimitive } |
    { pieceKey: string; kind: "capability"; recipe: PreparedCreationCapability }
  > = [];
  const capabilityInputs: Array<Exclude<CreationDraftPiece, { action: "reuse" }>> = [];
  const authoredNames = new Set<string>();
  const declared = new Map<string, number>();
  function registerAuthored(pieceKey: string, recipe: PreparedCharacterPrimitive) {
    if (authoredNames.has(recipe.snapshot.name)) {
      validationErrors.push({ code: "DUPLICATE_AUTHORED_NAME", pieceKey, message: "Give each new primitive a distinct name." });
      return;
    }
    authored.push({ pieceKey, kind: "primitive", recipe });
    authoredNames.add(recipe.snapshot.name);
    const { snapshot, snapshotDigest, sourceOrigin } = recipe;
    options.set(pieceKey, { id: -authored.length, versionId: null, snapshotDigest, sourceOrigin, freeFoundation: false,
      userId: actor.clerkId, name: snapshot.name, category: recipe.category, buCost: snapshot.buCost,
      isMirrorable: false, mirrorBuCredit: 0, hardModifiers: snapshot.hardModifiers, authored: recipe });
  }

  for (const piece of draft.pieces ?? []) {
    declared.set(piece.key, declared.size);
    if (piece.action === "create" && piece.kind === "primitive" && !piece.members?.length) {
      const recipe = prepareCharacterPrimitive(piece.fields, actor.clerkId);
      if (!recipe) {
        validationErrors.push({ code: "INVALID_AUTHORED_PRIMITIVE", pieceKey: piece.key,
          message: "Choose a name and cost tier, and give starter access an explicit matching composition rule. Use a library primitive for mirrored drawbacks." });
      } else registerAuthored(piece.key, recipe);
      continue;
    }
    if (piece.action === "fork" && piece.from.kind === "primitive" && !piece.members?.length) {
      forkSources.set(piece.key, { id: Number(piece.from.id), versionId: piece.from.versionId, changes: piece.changes });
      continue;
    }
    if ((piece.action === "create" && piece.kind === "capability") || (piece.action === "fork" && piece.from.kind === "capability")) {
      capabilityInputs.push(piece);
      continue;
    }
    if (piece.action === "reuse" && piece.pin.kind === "capability") {
      reusableCapabilities.set(piece.key, { id: piece.pin.id, versionId: piece.pin.versionId });
      continue;
    }
    if (piece.action !== "reuse" || piece.pin.kind !== "primitive") {
      validationErrors.push({ code: "UNSUPPORTED_PIECE", pieceKey: piece.key, message: "Use a supported primitive or primitive-member capability for the starter save. After saving it, use the character-piece review to create or attach effects, heritages or items." });
      continue;
    }
    reusable.set(piece.key, { id: Number(piece.pin.id), versionId: piece.pin.versionId });
  }
  const explicitMemberIds = capabilityInputs.flatMap(piece => (piece.members ?? []).flatMap(({ ref }) =>
    "pin" in ref && ref.pin.kind === "primitive" ? [Number(ref.pin.id)] : []));
  const suppliedIds = [...new Set([...reusable.values(), ...forkSources.values()].map(pin => pin.id).concat(explicitMemberIds))];
  const [definitions, capabilityDefinitions] = await Promise.all([
    loadDefinitions(actor.clerkId, suppliedIds),
    loadCreationCapabilities(actor.clerkId, [...new Set([...reusableCapabilities.values()].map(pin => pin.id)
      .concat(capabilityInputs.flatMap(piece => piece.action === "fork" ? [piece.from.id] : [])))]),
  ]);
  const findDefinition = (pin: { id: number; versionId: string }) => {
    const matches = definitions.filter(definition => definition.id === pin.id);
    return matches.length === 1 && matches[0]?.versionId === pin.versionId ? matches[0] : undefined;
  };
  for (const [key, pin] of reusable) {
    const definition = findDefinition(pin);
    if (definition) options.set(key, definition);
    else validationErrors.push({ code: "PIN_UNAVAILABLE", pieceKey: key, message: "The selected version is unavailable. Search for the piece again." });
  }
  for (const [pieceKey, pin] of forkSources) {
    const source = findDefinition(pin);
    if (!source) {
      validationErrors.push({ code: "PIN_UNAVAILABLE", pieceKey, message: "The selected version is unavailable. Search for the piece again." });
      continue;
    }
    const result = source.forkSourceMatchesLive
      ? prepareCharacterPrimitiveFork(source, pin.changes, actor.clerkId)
      : { error: "UNSUPPORTED_FORK_SOURCE" as const };
    if ("recipe" in result) registerAuthored(pieceKey, result.recipe);
    else {
      const messages = {
        UNSUPPORTED_FORK_SOURCE: "This primitive has fields that the starter fork cannot preserve. Reuse the pinned version or fork it in the Atelier.",
        INVALID_FORK_CHANGES: "Use a valid private primitive name, cost and compatible composition rule.",
        UNCHANGED_FORK: "Change a field to create a fork, or reuse this version.",
      };
      validationErrors.push({ code: result.error, pieceKey, message: messages[result.error] });
    }
  }
  const authoredPrimitives = authored.filter(piece => piece.kind === "primitive");
  if (authoredPrimitives.length) {
    const families = [...new Set(authoredPrimitives.map(piece => piece.recipe.familyKey))];
    const registered = await db.select({ key: lexiconFamilies.key }).from(lexiconFamilies).where(inArray(lexiconFamilies.key, families));
    if (registered.length !== families.length) validationErrors.push({ code: "MARKET_UNAVAILABLE", message: "The market classification for a new primitive is unavailable." });
  }
  const capabilityOptions = new Map<string, PlannedCapability>();
  for (const [key, pin] of reusableCapabilities) {
    const capability = capabilityDefinitions.find(definition => definition.id === pin.id && definition.versionId === pin.versionId);
    if (capability) capabilityOptions.set(key, capability);
    else validationErrors.push({ code: "PIN_UNAVAILABLE", pieceKey: key, message: "The selected version is unavailable. Search for the piece again." });
  }

  const usedKeys = new Set<string>();
  const capabilityNames = new Set<string>();
  for (const piece of capabilityInputs) {
    const forkSource = piece.action === "fork" ? capabilityDefinitions.find(source =>
      source.id === piece.from.id && source.versionId === piece.from.versionId) : undefined;
    if (piece.action === "fork" && !forkSource) {
      validationErrors.push({ code: "PIN_UNAVAILABLE", pieceKey: piece.key, message: "The selected capability version or one of its members is unavailable." });
      continue;
    }
    const members = piece.members ?? [];
    if ((!members.length && !(forkSource && piece.members === undefined)) || members.length > maxCreationCapabilityMembers) {
      validationErrors.push({ code: "CAPABILITY_MEMBER_LIMIT", pieceKey: piece.key,
        message: `Choose between 1 and ${maxCreationCapabilityMembers} distinct primitive members.` });
      continue;
    }
    const memberAliases: string[] = [];
    const resolved = [];
    for (const { ref, role, quantity, isMirrored } of members) {
      const pin = "pin" in ref && ref.pin.kind === "primitive" ? { id: Number(ref.pin.id), versionId: ref.pin.versionId } : undefined;
      if (!(pin || ("pieceKey" in ref && (forkSources.has(ref.pieceKey) || reusable.has(ref.pieceKey) || options.has(ref.pieceKey)))) || !role || isMirrored) {
        validationErrors.push({ code: "UNSUPPORTED_CAPABILITY_MEMBER", pieceKey: piece.key,
          message: "Choose pinned or privately authored primitives with native roles and leave their mirror flags off." });
        break;
      }
      const primitive = "pieceKey" in ref ? options.get(ref.pieceKey) : pin && findDefinition(pin);
      if (!primitive) {
        validationErrors.push({ code: "PIN_UNAVAILABLE", pieceKey: piece.key, message: "A selected member version is unavailable. Search for the piece again." });
        break;
      }
      const authoredPieceKey = "pieceKey" in ref && primitive.versionId === null ? ref.pieceKey : undefined;
      resolved.push({ primitive, role, quantity: quantity ?? 1, ...(authoredPieceKey ? { authoredPieceKey } : {}) });
      if ("pieceKey" in ref) memberAliases.push(ref.pieceKey);
    }
    if (resolved.length !== members.length) continue;
    const forkResult = piece.action === "fork" && forkSource
      ? prepareCreationCapabilityFork(forkSource, piece.changes, piece.members === undefined ? undefined : resolved, actor.clerkId) : undefined;
    if (forkResult && "error" in forkResult) {
      validationErrors.push({ code: forkResult.error, pieceKey: piece.key,
        message: forkResult.error === "UNCHANGED_FORK" ? "Change a capability field or its members, or reuse this version."
          : "The starter cannot reproduce this capability with the requested changes. Use a supported capability or edit it in the Atelier." });
      continue;
    }
    const recipe = piece.action === "create" ? preparePrivateCreationCapability(piece.fields, resolved, actor.clerkId) : forkResult?.recipe;
    if (!recipe || capabilityNames.has(recipe.name)) {
      validationErrors.push({ code: "INVALID_AUTHORED_CAPABILITY", pieceKey: piece.key,
        message: "Give each new capability a distinct name, valid type and source, and distinct primitive members." });
      continue;
    }
    capabilityNames.add(recipe.name);
    capabilityOptions.set(piece.key, { id: `draft:${piece.key}`, name: recipe.name, versionId: null,
      snapshotDigest: recipe.snapshotDigest, members: recipe.members, authored: recipe });
    authored.push({ pieceKey: piece.key, kind: "capability", recipe });
    for (const alias of memberAliases) usedKeys.add(alias);
  }
  const authorOrder = new Map(orderedCreationAuthors(draft).map(({ key }, index) => [key, index]));
  authored.sort((left, right) => (authorOrder.get(left.pieceKey) ?? Infinity) - (authorOrder.get(right.pieceKey) ?? Infinity));
  if (authored.length >= 20) validationErrors.push({ code: "STEP_LIMIT", message: "Use at most 19 new pieces in one character review." });

  const mirroredIds = new Set<number>();
  const mirrors: PrimitiveDefinition[] = [];
  const directSlots: CreationSlot[] = [];
  const capabilities: CapabilitySlot[] = [];
  const placedCapabilities = new Map<string, CapabilitySlot>();
  for (const placement of draft.placements ?? []) {
    const key = placement.pieceKey;
    usedKeys.add(key);
    if (!declared.has(key)) {
      validationErrors.push({ code: "MISSING_REFERENCE", pieceKey: key, message: "A placement references an unknown piece key." });
      continue;
    }
    const capability = capabilityOptions.get(key);
    if (capability) {
      if (placement.source === "ITEM" || placement.isMirrored) {
        validationErrors.push({ code: "INVALID_CAPABILITY_PLACEMENT", pieceKey: key, message: "Choose a character tab for this capability and leave its mirror flag off." });
      } else if (placedCapabilities.has(capability.id)) {
        validationErrors.push({ code: "DUPLICATE_CAPABILITY", pieceKey: key, message: "Place each capability only once." });
      } else {
        const slot = { pieceKey: key, capability, source: placement.source === "PERSONAL" ? "MANIFEST" as const : placement.source };
        capabilities.push(slot);
        placedCapabilities.set(capability.id, slot);
      }
      continue;
    }
    const primitive = options.get(key);
    if (!primitive) continue;
    if (placement.source === "ITEM") {
      validationErrors.push({ code: "INVALID_SOURCE", pieceKey: key, message: "Choose a character source for this primitive." });
      continue;
    }
    const isMirrored = placement.isMirrored ?? false;
    const drawback = isMirrored ? creationDrawback(primitive.hardModifiers, primitive.snapshot) : null;
    if (isMirrored) {
      const eligibility = canAcceptMirror(level, mirrors, primitive);
      if (mirroredIds.has(primitive.id) || !eligibility.allowed) {
        validationErrors.push({ code: "INVALID_MIRROR", pieceKey: key, message: mirroredIds.has(primitive.id)
          ? "Each primitive can be mirrored only once." : eligibility.reason ?? "This mirror is unavailable." });
        continue;
      }
      if (!drawback) {
        validationErrors.push({ code: "INVALID_MIRROR", pieceKey: key, message: "The selected version has no reviewable mirrored effect. Choose a drawback with an explicit mechanical effect." });
        continue;
      }
      mirrors.push(primitive);
      mirroredIds.add(primitive.id);
    }
    directSlots.push({ pieceKey: key, primitive, source: placement.source, isMirrored, ...(drawback ? { drawback } : {}) });
  }
  for (const key of new Set([...reusable.keys(), ...reusableCapabilities.keys(), ...forkSources.keys(), ...authored.map(piece => piece.pieceKey)])) {
    if (!usedKeys.has(key)) missing.push(`placements.${key}`);
  }

  const expand = () => adoptCreationPurchases(expandBundles({
    primitives: directSlots.map(slot => ({ primitiveId: slot.primitive.id, source: slot.source, isMirrored: slot.isMirrored })),
    capabilities: capabilities.map(({ capability, source }) => ({ id: capability.id, source,
      primitiveLinks: capability.members.map(member => ({ primitiveId: member.id })), effectLinks: [] })),
    effects: [], heritages: [],
  }));
  const allDefinitions = new Map([...options.values(), ...capabilities.flatMap(slot =>
    slot.capability.members.map(member => member.primitive))].map(definition => [definition.id, definition]));
  const initialExpansion = expand();
  const missingAccess = missingCreationAccess(initialExpansion, [...allDefinitions.values()]);
  const startingAccess: Record<StartingAccess, AccessStatus> = {
    verbTier: missingAccess.includes("verb tier") ? "missing" : "selected",
    domain: missingAccess.includes("domain") ? "missing" : "selected",
    range: "missing",
    dieType: "missing",
  };
  // Die-size access is INTENSITY_DICE. OUTPUT and dice-count modifiers cannot fill it.
  const positiveCategories = new Set(initialExpansion.primitives.filter(slot => !slot.isMirrored)
    .map(slot => allDefinitions.get(slot.primitiveId)?.category));
  for (const foundation of FREE_CREATION_FOUNDATIONS) {
    if (positiveCategories.has(foundation.category)) {
      startingAccess[foundation.access] = "selected";
      continue;
    }
    const candidates = definitions.filter(definition => definition.freeFoundation &&
      definition.name === foundation.name && definition.category === foundation.category);
    const chosen = candidates.find(definition => definition.id === foundation.id) ??
      candidates.find(definition => definition.sourceOrigin === "SRD" || definition.userId === null);
    if (!chosen || definitions.filter(definition => definition.id === chosen.id).length !== 1) {
      validationErrors.push({ code: "FOUNDATION_UNAVAILABLE", message: `The free ${foundation.name} version is unavailable.` });
      continue;
    }
    directSlots.push({ pieceKey: null, primitive: chosen, source: "PERSONAL", isMirrored: false });
    allDefinitions.set(chosen.id, chosen);
    startingAccess[foundation.access] = "freeBaseline";
  }
  for (const [access, status] of Object.entries(startingAccess)) {
    if (status === "missing") missing.push(`startingAccess.${access}`);
  }

  const expansion = expand();
  const slots: CreationSlot[] = capabilities.length ? expansion.primitives.map(placement => {
    const { primitiveId, source, isMirrored, originCapabilityId, instanceIndex, directSource } = placement;
    if (originCapabilityId) {
      const origin = placedCapabilities.get(originCapabilityId)!;
      const member = origin.capability.members.find(candidate => candidate.id === primitiveId)!;
      const memberKey = "authoredPieceKey" in member ? member.authoredPieceKey : undefined;
      return { pieceKey: memberKey ?? origin.pieceKey, primitive: memberKey ? options.get(memberKey)! : member.primitive, source, isMirrored, originCapabilityId,
        ...(!origin.capability.versionId ? { originCapabilityPieceKey: origin.pieceKey } : {}),
        ...(directSource ? { directSource } : {}) };
    }
    return directSlots.filter(slot => slot.primitive.id === primitiveId && slot.isMirrored === isMirrored)[instanceIndex]!;
  }) : directSlots;
  const costs = summarizeExpansionCost(expansion,
    new Map([...allDefinitions].map(([id, definition]) => [id, definition.buCost])),
    new Map([...allDefinitions].map(([id, definition]) => [id, definition.mirrorBuCredit])),
  );
  const budget = { level, startingBu, positiveSpent: costs.positiveCost, mirrorCredit: costs.mirrorCredit,
    ...creationBudget({ level, budget: startingBu, positiveSpent: costs.positiveCost, mirrorCredit: costs.mirrorCredit }) };
  if (budget.aboveNextLevel) validationErrors.push({ code: "BUDGET_LIMIT", message: `The build exceeds the next-level ceiling of ${budget.nextLevelBudget} BU.` });
  if (budget.needsDmApproval && !budget.aboveNextLevel) tableQuestions.push(`Can the table approve the ${budget.overflow} BU above the level-one pool? Reduce the cost to continue this starter save.`);

  const normalized = {
    schemaVersion: 1 as const,
    name: draft.name || null,
    attributes: { ...draft.attributes, proficient: proficient ?? null },
    size: draft.size!,
    isPublic: false as const,
    startingAccess,
    backstory: draft.backstory!,
    placements: slots.map(({ primitive, pieceKey, source, isMirrored, drawback, originCapabilityId, originCapabilityPieceKey, directSource }) => ({
      pieceKey, name: primitive.name, category: primitive.category, source, isMirrored,
      buCost: isMirrored ? 0 : primitive.buCost,
      mirrorCredit: isMirrored ? primitive.mirrorBuCredit : 0,
      ...(drawback ? { drawback } : {}),
      pin: primitive.versionId ? { kind: "primitive" as const, id: String(primitive.id), versionId: primitive.versionId } : null,
      ...(originCapabilityPieceKey ? { originCapabilityPieceKey } : originCapabilityId ? { originCapabilityId } : {}),
      ...(directSource ? { directSource } : {}),
      ...(primitive.authored ? { authored: { category: primitive.authored.category, familyKey: primitive.authored.familyKey,
        costTier: primitive.authored.snapshot.costTier, narrativeRule: primitive.authored.snapshot.narrativeRule,
        mechanicalOutputText: primitive.authored.snapshot.mechanicalOutputText, isPublic: false as const, ownership: "player" as const,
        ...(primitive.authored.fork ? { forkedFrom: { name: primitive.authored.fork.name, pin: {
          kind: "primitive" as const, id: String(primitive.authored.fork.id), versionId: primitive.authored.fork.versionId,
        } } } : {}) } } : {}),
    })),
    ...(capabilities.length ? {
      capabilities: capabilities.map(({ pieceKey, capability, source }) => ({
        pieceKey, name: capability.name, source,
        pin: capability.versionId ? { kind: "capability" as const, id: capability.id, versionId: capability.versionId } : null,
        ...("authored" in capability ? { authored: { type: capability.authored.type, sourceType: capability.authored.sourceType,
          verboseDescription: capability.authored.description, componentBu: capability.authored.totalBu,
          isPublic: false as const, ownership: "player" as const,
          ...(capability.authored.fork ? { forkedFrom: { name: capability.authored.fork.name, pin: { kind: "capability" as const,
            id: capability.authored.fork.id, versionId: capability.authored.fork.versionId } } } : {}) } } : {}),
        members: capability.members.map(({ primitive, id, ...slot }) => ({
          ...slot, name: primitive.name,
          pin: primitive.versionId ? { kind: "primitive" as const, id: String(id), versionId: primitive.versionId } : null,
        })),
      })),
    } : {}),
  };
  const preview = { normalized, missing, validationErrors, tableQuestions, budget };
  if (!validationErrors.length && !draftV1.safeParse(draft).success) {
    validationErrors.push({ code: "DRAFT_LIMIT", message: "The normalized draft exceeds the size limit." });
  }
  const fingerprint = !missing.length && !validationErrors.length && !tableQuestions.length
    ? digest({ actor: [actor.id, actor.clerkId], draft, preview, snapshots: slots.map(slot => slot.primitive.snapshotDigest),
      ...(capabilities.length ? { capabilitySnapshots: capabilities.map(slot => ({ root: slot.capability.snapshotDigest,
        members: slot.capability.members.map(member => member.primitive.snapshotDigest) })) } : {}) }) : null;
  return { preview, slots, capabilities, authored, prepared: fingerprint ? { fingerprint, draft } : null };
}
