import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { mcpChallenge, resolveMcpActor, type McpActor, type McpIdentity } from "./auth";
import { CatalogueCursorError, findCreations, findCreationsInput, getCatalogueCursorSecret } from "./catalogue";
import { applyApprovedAdvancement, prepareCharacterAdvancement, prepareCharacterAdvancementInput, previewCharacterAdvancement, previewCharacterAdvancementInput } from "./character-advancement";
import { applyCharacterPiece, prepareCharacterPiece, prepareCharacterPieceInput } from "./character-piece";
import { characterContextInput, listAccessibleCharacters, listAccessibleCharactersInput, readCharacterBuild } from "./character-context";
import { listCharacterCompanionLinks, listCharacterCompanionsInput } from "./character-companions";
import { applyCharacterEdit, applyCharacterEditInput, prepareCharacterEdit, prepareCharacterEditInput, previewCharacterEdit, previewCharacterEditInput } from "./character-edits";
import { CharacterProposalUnavailable, listCharacterProposals, listCharacterProposalsInput, readCharacterProposal, readCharacterProposalInput, resolveVersionProposalRef } from "./character-proposals";
import { characterSheetPdfInput, getCharacterSheetPdfLink } from "./character-sheet-pdf";
import { characterToolsEnabled, configuredScopes, MCP_EDIT_SCOPE, MCP_PLAY_SCOPE, MCP_SCOPES, type McpConfig } from "./config";
import { applyCompanion, companionBestiaryUrl, prepareCompanion, prepareCompanionInput, previewCompanion, previewCompanionInput } from "./companion-authoring";
import { CharacterContextUnavailable, ContextCursorError } from "./context-shared";
import { readFixture } from "./fixtures";
import { browserReviewEnabled, characterAdvancementReceipt, companionCreationReceipt, operationUuid, stagingReviewEnabled, versionProposalWritesEnabled } from "./operation-policy";
import { executeApprovedOperation, getOperationStatus, OperationAttemptTimeout, OperationBlockError, OperationUnavailableError, prepareOperation } from "./operations";
import { applyPlayAction, applyPlayActionInput, preparePlayAction, preparePlayActionInput, previewPlayAction, previewPlayActionInput } from "./play-actions";
import { characterHistoryInput, readCharacterHistory, readCharacterPlayState } from "./play-context";
import { portraitPromptInput, preparePortraitPrompt } from "./portrait-prompt";
import { prepareProgressionNote, progressionNoteInput, saveProgressionNote } from "./progression-note";
import {
  prepareCharacterProposal, prepareCharacterProposalInput, prepareProposalDecision, prepareProposalDecisionInput,
  previewCharacterProposal, previewCharacterProposalInput, reviewCharacterProposal, reviewCharacterProposalInput,
  submitCharacterProposal, submitCharacterProposalInput,
} from "./proposal-actions";
import {
  CharacterCapabilityConflictError, CharacterPrimitiveConflictError, creationStepKinds, draftV1, performPinnedCharacterCreationStep, preparePinnedCharacterCreation, previewCharacter,
  previewCharacterInput, StaleCharacterCreationError, type CharacterCreationPreview,
} from "./proposal";
import { characterReviewResultMeta, characterReviewToolMeta, registerCharacterReviewResource } from "./review-resource";
import { readGuideRules } from "./rules";
import { prepareSessionNote, prepareSessionNoteInput, previewSessionNote, previewSessionNoteInput, saveSessionNote, saveSessionNoteInput } from "./session-notes";
import { prepareVersionProposal, prepareVersionProposalDecision, prepareVersionProposalDecisionInput, prepareVersionProposalInput, reviewVersionProposal, submitVersionProposal } from "./version-proposal-actions";

const readOnly = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const fixtureOutput = {
  displayName: z.string(),
  receipt: z.string().uuid().nullable(),
};
const reviewedWrite = { ...readOnly, readOnlyHint: false };
const createScopes = [MCP_SCOPES.read, MCP_SCOPES.create] as const;
const playScopes = [MCP_SCOPES.read, MCP_PLAY_SCOPE] as const;
const editScopes = [MCP_SCOPES.read, MCP_EDIT_SCOPE] as const;
const pieceScopes = [...editScopes, MCP_SCOPES.create] as const;
const operationInput = z.strictObject({ operationId: operationUuid });
const supersedesOperationId = operationUuid.optional();
const preparedCreation = z.object({ draft: draftV1, fingerprint: z.string().regex(/^[a-f0-9]{64}$/) });
const editToolInput = z.strictObject({
  ...previewCharacterEditInput.shape,
  intent: z.enum(["apply", "propose"]),
  rationale: z.string().max(2_000).describe("A note for a proposal. Omit for a direct apply.").optional(),
});

function result(data: Record<string, unknown>, message: string): CallToolResult {
  return { content: [{ type: "text", text: message }], structuredContent: data };
}

function failure(message: string, code?: string): CallToolResult {
  return { isError: true, content: [{ type: "text", text: message }], ...(code ? { structuredContent: { code } } : {}) };
}

function toolSecurity(...scopes: string[]) {
  return { securitySchemes: [{ type: "oauth2", scopes }] };
}

function creationMessage(preview: CharacterCreationPreview) {
  const names = { verbTier: "Verb tier", domain: "Domain", range: "Range", dieType: "Die type" } as const;
  const category = { verbTier: "VERB_TIER", domain: "DOMAIN", range: "RANGE", dieType: "INTENSITY_DICE" } as const;
  const lines = Object.keys(names).map(key => {
    const access = key as keyof typeof names;
    const selected = preview.normalized.placements.filter(piece => !piece.isMirrored && piece.category === category[access]);
    const baseline = access === "range" ? "Touch (0 BU)" : "1d4 (0 BU)";
    return `**${names[access]}** — ${preview.normalized.startingAccess[access] === "freeBaseline" ? baseline : selected.map(piece => piece.name).join(", ") || "Choose a primitive"}`;
  });
  const drawbacks = preview.normalized.placements.filter(piece => piece.isMirrored);
  for (const piece of drawbacks) {
    lines.push([`**Mirrored drawback · ${piece.name}** (${piece.mirrorCredit} BU credit)`,
      piece.drawback?.description, piece.drawback?.eligibilityNotes].filter(Boolean).join("\n\n"));
  }
  for (const capability of preview.normalized.capabilities ?? []) {
    const members = capability.members.map(member => `${member.quantity > 1 ? `${member.quantity} × ` : ""}${member.name} (${member.role.toLowerCase()})`);
    const label = capability.authored?.forkedFrom ? ` · Private fork of ${capability.authored.forkedFrom.name}`
      : capability.authored ? " · New private capability" : "";
    lines.push(`**${capability.name}**${label} — ${members.join(", ")}.`);
  }
  const forks = new Set(preview.normalized.placements.flatMap(({ name, authored }) =>
    authored?.forkedFrom ? [`${name} from ${authored.forkedFrom.name}`] : []));
  if (forks.size) lines.push(`**Private forks** — ${[...forks].join(", ")}.`);
  lines.push(...preview.validationErrors.map(issue => issue.message), ...preview.tableQuestions);
  const otherMissing = preview.missing.filter(field => !field.startsWith("startingAccess."));
  if (otherMissing.length) lines.push(`Still needed for this draft · ${otherMissing.join(", ")}.`);
  const { physical, mental, magical, proficient } = preview.normalized.attributes;
  if (physical !== undefined && mental !== undefined && magical !== undefined) {
    lines.push(`Physical ${physical}, Mental ${mental}, Magical ${magical}${proficient ? ` · Proficient in ${proficient.toLowerCase()}` : ""} · ${preview.normalized.size.toLowerCase()} size`);
  }
  lines.push(`Level ${preview.budget.level} starts with ${preview.budget.startingBu} BU. Selected primitives cost ${preview.budget.positiveSpent} BU before ${preview.budget.mirrorCredit} BU of eligible drawback credit.`);
  return lines.join("\n\n");
}

function advancementMessage(data: Awaited<ReturnType<typeof previewCharacterAdvancement>>) {
  const { before, after } = data;
  return [
    `**${data.characterName}** · Level ${before.level} → ${after.level}`,
    `Build Units ${before.progressionPool} → ${after.progressionPool}. After advancement: ${after.progressionSpent} spent and ${after.progressionRemaining} available.`,
    ...(before.debtUsed || before.uncoveredExcess || after.debtUsed || after.uncoveredExcess ? [
      `Drawback debt used ${before.debtUsed} → ${after.debtUsed} BU. Uncovered excess ${before.uncoveredExcess} → ${after.uncoveredExcess} BU.`,
    ] : []),
    `Proficiency ${before.proficiencyBonus} → ${after.proficiencyBonus}. Maximum Vitality ${before.maxVitality} → ${after.maxVitality}. Volatility ceiling ${before.volatilityCeiling} → ${after.volatilityCeiling} BU.`,
    ...(before.dmBonusBu ? [`Advancement consumes the current ${before.dmBonusBu} bonus BU. The after-budget reflects that reset.`] : []),
    `Existing purchases stay in place. The current Vitality setting (${data.currentVitality}) is kept.`,
  ].join("\n\n");
}

function operationMessage(data: Awaited<ReturnType<typeof getOperationStatus>>) {
  if (data.downloadUrl) return `[Download the approved progression PDF](${data.downloadUrl}).`;
  if (data.kind === "character_advancement" && data.sheetUrl) {
    const advancement = characterAdvancementReceipt.parse(data.receipt);
    return `Advancement saved. Level ${advancement.fromLevel} → ${advancement.level}, with ${advancement.progressionRemaining} Build Units remaining. [Open the updated character sheet](${data.sheetUrl}).`;
  }
  if (data.kind === "session_note" && data.sheetUrl) return `Player Notes updated. [Open the character sheet](${data.sheetUrl}).`;
  if (data.kind === "session_play_action" && data.sheetUrl && data.receipt) {
    const receipt = data.receipt;
    const outcome = "vitality" in receipt ? `Saved Current Vitality: ${receipt.vitality}.`
      : "previousVitality" in receipt && "currentVitality" in receipt
        ? `Saved consequence package. Current Vitality ${receipt.previousVitality} → ${receipt.currentVitality}.`
      : "Saved the consequence change.";
    return `${outcome} [Open the character sheet](${data.sheetUrl}).`;
  }
  if (data.sheetUrl && data.sheetPdfUrl) {
    return `[Open the saved character sheet](${data.sheetUrl}) or [Download the character-sheet PDF](${data.sheetPdfUrl}).`;
  }
  if (data.sheetUrl) return `[Open the saved character sheet](${data.sheetUrl}).`;
  if (data.approvalUrl) return `[Review the change in SwordWeave](${data.approvalUrl}).`;
  if (data.state === "approved") return data.steps.some(step => step.state === "committed")
    ? "The earlier step was saved. Continue the approved save when the player asks."
    : "This review was approved. Continue the save when the player asks.";
  if (data.state === "blocked") return "The save needs a new review because the build or its dependencies changed.";
  return `Operation status · ${data.state}.`;
}

export function createSwordWeaveMcpServer(config: McpConfig, identity: McpIdentity | null) {
  const server = new McpServer({ name: "swordweave", version: "0.1.0" });
  async function withActor(scope: string | readonly string[], action: (actor: McpActor) => CallToolResult | Promise<CallToolResult>) {
    const required = typeof scope === "string" ? [scope] : scope;
    if (!identity || required.some(permission => !identity.scopes.includes(permission))) {
      const problem = failure(identity ? "This tool needs additional SwordWeave permission." : "Connect your SwordWeave account.");
      return { ...problem, _meta: { "mcp/www_authenticate": [mcpChallenge(config, required.join(" "), !!identity)] } };
    }
    try {
      const actor = await resolveMcpActor(identity);
      const allowed = config.privateTest?.userIds ?? config.fixtureUserIds;
      return actor && (!allowed.length || allowed.includes(actor.id))
        ? await action(actor) : failure("The linked SwordWeave account is unavailable.");
    } catch (error) {
      if (error instanceof OperationUnavailableError || error instanceof CharacterContextUnavailable || error instanceof CharacterProposalUnavailable) {
        return failure(error.message, "UNAVAILABLE");
      }
      if (error instanceof ContextCursorError) return failure(error.message, "UNAVAILABLE");
      if (error instanceof OperationBlockError) return failure("SwordWeave could not prepare this change. Open the current sheet and review it again.", error.code);
      if (error instanceof OperationAttemptTimeout) return failure(error.message, "RETRY_AFTER_STATUS");
      return failure("SwordWeave could not complete the request. Please try again.");
    }
  }

  if (config.fixtureUserIds.length) {
    if (config.readEnabled) {
      server.registerTool("read_test_fixture", {
        title: "Read SwordWeave test fixture",
        description: "Read the fictional test player's own in-memory receipt. Use only for the isolated connection test.",
        inputSchema: z.strictObject({}),
        outputSchema: fixtureOutput,
        annotations: readOnly,
        _meta: toolSecurity(MCP_SCOPES.read),
      }, () => withActor(MCP_SCOPES.read, actor => {
        const fixture = readFixture(actor.id, config.fixtureUserIds, false);
        return fixture ? result(fixture, `${fixture.displayName}: ${fixture.receipt ?? "No test receipt yet."}`)
          : failure("This account is outside the fictional fixture.");
      }));
    }
    if (config.writeEnabled) {
      server.registerTool("save_test_fixture", {
        title: "Save SwordWeave test receipt",
        description: "Save one disposable in-memory receipt when the fictional test player asks to save. The tool never writes a character.",
        inputSchema: z.strictObject({}),
        outputSchema: fixtureOutput,
        annotations: { ...readOnly, readOnlyHint: false },
        _meta: toolSecurity(MCP_SCOPES.create),
      }, () => withActor(MCP_SCOPES.create, actor => {
        const fixture = readFixture(actor.id, config.fixtureUserIds, true);
        return fixture ? result(fixture, `Test receipt ${fixture.receipt} is saved for ${fixture.displayName}.`)
          : failure("This account is outside the fictional fixture.");
      }));
    }
    if (!stagingReviewEnabled(config)) return server;
  }

  if (config.readEnabled) {
    registerCharacterReviewResource(server, config.resource);
    server.registerTool("get_character_sheet_pdf_link", {
      title: "Download character sheet PDF",
      description: "Get the standard SwordWeave Print/Download sheet for a saved character you own or can access through an active share. Open the returned link in your signed-in browser. Use default print settings unless the player requests different settings.",
      inputSchema: characterSheetPdfInput, annotations: readOnly, _meta: toolSecurity(MCP_SCOPES.read),
    }, input => withActor(MCP_SCOPES.read, async actor => {
      const data = await getCharacterSheetPdfLink(actor, input, config.resource);
      return result(data, `[Download the character sheet PDF](${data.downloadUrl}).`);
    }));
    if (characterToolsEnabled(config, "COMPANIONS", "READ")) {
      server.registerTool("list_character_companions", {
        title: "Open a character's monster companions",
        description: "List permitted links for a selected character's attached monster companions. Use the play sheet to track that creature's Vitality and consequences, the pinned Bestiary link for its rules, and the standard PDF for printable companion pages. Manage attachments in character sheet Edit mode.",
        inputSchema: listCharacterCompanionsInput, annotations: readOnly, _meta: toolSecurity(MCP_SCOPES.read),
      }, input => withActor(MCP_SCOPES.read, async actor => {
        const data = await listCharacterCompanionLinks(actor, input, config.resource);
        const links = data.companions.flatMap(({ playSheetUrl, bestiary }, index) => [
          ...(playSheetUrl ? [`[Open companion ${index + 1} play sheet](${playSheetUrl})`] : []),
          ...(bestiary ? [`[Open companion ${index + 1} Bestiary reference](${bestiary.url})`] : []),
        ]);
        return result(data, [
          `[Open the Companions section](${data.sheetUrl})`, ...links,
          `[Download the standard character sheet PDF](${data.downloadUrl})`,
        ].join("\n\n"));
      }));
    }
    server.registerTool("read_rules", {
      title: "Read SwordWeave rules",
      description: "Look up SwordWeave Play Guide topics. Search with short game terms and cite the matching guide links.",
      inputSchema: z.strictObject({ question: z.string().trim().min(1).max(160) }),
      annotations: readOnly,
      _meta: toolSecurity(MCP_SCOPES.read),
    }, ({ question }) => withActor(MCP_SCOPES.read, () => {
      const data = readGuideRules(question, config.resource);
      const topics = data.entries.map(entry => {
        const details = entry.ruleDetails?.map(block => [block.title, block.body, ...block.rules ?? [], block.example].filter(Boolean).join("\n")) ?? [];
        return [`[${entry.title}](${entry.url})`, entry.summary, ...entry.startingAccess ?? [], ...details].join("\n\n");
      });
      return result(data, topics.join("\n\n") || "No matching guide topics. Try a shorter SwordWeave term such as Vitality or rest.");
    }));
    server.registerTool("prepare_portrait_prompt", {
      title: "Prepare a character portrait prompt",
      description: "Create a copyable prompt for the player's preferred image generator. Use only concept and visual details they want included. The result is text for the player to paste into a new image-generation chat or another generator.",
      inputSchema: portraitPromptInput, annotations: readOnly, _meta: toolSecurity(MCP_SCOPES.read),
    }, input => withActor(MCP_SCOPES.read, () => {
      const data = preparePortraitPrompt(input);
      return result(data, [data.prompt, data.nextStep,
        ...data.referenceImages.map(({ name, url }) => `[${name}](${url})`)].join("\n\n"));
    }));
    const cursorSecret = getCatalogueCursorSecret();
    if (cursorSecret) {
      server.registerTool("find_creations", {
        title: "Find SwordWeave creations",
        description: "Find authorized catalogue pieces by name and type. During initial creation, use startingCategory for verb tiers, domains, ranges and die types. For existing characters, use returned exact pins for eligible primitives, capabilities, effects, items and heritages. Use the returned cursor for the next page.",
        inputSchema: findCreationsInput,
        annotations: readOnly,
        _meta: toolSecurity(MCP_SCOPES.read),
      }, input => withActor(MCP_SCOPES.read, async actor => {
        try {
          const data = await findCreations(input, actor, { resource: config.resource, cursorSecret });
          const lines = data.items.map(item => `[${item.name}](${item.source}) · ${item.matchReason}`);
          if (data.nextCursor) lines.push("More results may be available on the next page.");
          return result(data, lines.join("\n") || "No matching creations.");
        } catch (error) {
          if (error instanceof CatalogueCursorError) return failure(error.message);
          throw error;
        }
      }));

      const context = {
        resource: config.resource,
        cursorSecret,
        versionProposalReads: stagingReviewEnabled(config) && process.env["MCP_CHARACTER_VERSION_PROPOSAL_READS_ENABLED"] === "true",
      };
      if (characterToolsEnabled(config, "EDIT", "READ")) {
        server.registerTool("list_accessible_characters", {
          description: "List the linked player's own or actively shared SwordWeave characters.",
          inputSchema: listAccessibleCharactersInput, annotations: readOnly, _meta: toolSecurity(MCP_SCOPES.read),
        }, input => withActor(MCP_SCOPES.read, async actor => {
          const data = await listAccessibleCharacters(actor, input, context);
          return result(data, data.items.map(item => `[${item.name}](${item.sheetUrl}) · Level ${item.level} · ${item.permission}`).join("\n") || "No accessible characters on this page.");
        }));
        server.registerTool("read_character_build", {
          description: "Read the selected character's visible build, budget, and version-pinned occurrence paths.",
          inputSchema: characterContextInput, annotations: readOnly, _meta: toolSecurity(MCP_SCOPES.read),
        }, input => withActor(MCP_SCOPES.read, async actor => {
          const data = await readCharacterBuild(actor, input, context);
          return result(data, `[${data.name}](${data.sheetUrl}) · ${data.slots.length} visible build slots.${data.partial ? " View the sheet for additional context." : ""}`);
        }));
        server.registerTool("list_character_proposals", {
          description: context.versionProposalReads
            ? "List workspace or exact-slot version proposals available to a character owner or the submitting player. Use the version subtype explicitly for version proposals."
            : "List existing workspace proposals available to a character owner or the submitting player.",
          inputSchema: listCharacterProposalsInput, annotations: readOnly, _meta: toolSecurity(MCP_SCOPES.read),
        }, input => withActor(MCP_SCOPES.read, async actor => {
          const data = await listCharacterProposals(actor, input, context);
          return result(data, `${data.items.length} ${input.subtype ?? "workspace"} proposals on this page. [Open the character sheet](${data.sheetUrl}).`);
        }));
        server.registerTool("read_character_proposal", {
          description: "Read an authorized proposal summary using its opaque reference from the proposal list.",
          inputSchema: readCharacterProposalInput, annotations: readOnly, _meta: toolSecurity(MCP_SCOPES.read),
        }, input => withActor(MCP_SCOPES.read, async actor => {
          const data = await readCharacterProposal(actor, input, context);
          const sheetAction = data.subtype === "version" && !data.reviewAvailable ? "Review version details on the character sheet" : "Open the character sheet";
          const diffStatus = data.subtype === "workspace" && data.diffState === "stale" ? " The proposal needs a fresh review."
            : data.subtype === "workspace" && data.diffState === "unavailable" ? " The reviewed changes are unavailable here." : "";
          return result(data, `Proposal is ${data.status}.${diffStatus} [${sheetAction}](${data.sheetUrl}).${data.description ? `\n\n${data.description}` : ""}`);
        }));
      }
      if (characterToolsEnabled(config, "PLAY", "READ")) {
        server.registerTool("read_character_history", {
          description: "Read recent play events for a character owned by the linked player.",
          inputSchema: characterHistoryInput, annotations: readOnly, _meta: toolSecurity(MCP_SCOPES.read),
        }, input => withActor(MCP_SCOPES.read, async actor => {
          const data = await readCharacterHistory(actor, input, context);
          const entries = data.entries.map(entry => {
            if (entry.kind === "vitality_change") return `Vitality ${entry.previous} → ${entry.current}`;
            if (entry.kind === "rest") return `${entry.restType === "short" ? "Short" : "Long"} rest · ${entry.vitalityRestored} Vitality restored`;
            return `Used ${entry.name}`;
          });
          return result(data, [entries.length ? entries.join("\n") : "No visible play events on this page.",
            data.nextCursor ? "More play events may be available on the next page." : "",
            `[Open the character sheet](${data.sheetUrl}).`].filter(Boolean).join("\n\n"));
        }));
      }
    }
    if (characterToolsEnabled(config, "EDIT", "READ")) {
      server.registerTool("preview_character_advancement", {
        description: "Preview a character you own advancing to an exact higher level. Get the character and latest revision from read_character_build first. Show the before and after Build Units, proficiency and Vitality. This does not buy new abilities or change the sheet.",
        inputSchema: previewCharacterAdvancementInput, annotations: readOnly, _meta: toolSecurity(MCP_SCOPES.read),
      }, input => withActor(MCP_SCOPES.read, async actor => {
        const data = await previewCharacterAdvancement(actor, input);
        return result(data, advancementMessage(data));
      }));
      server.registerTool("preview_character_edit", {
        description: "Preview a character edit or proposal. Attach eligible pinned pieces, remove root placements, mirror eligible primitives, or change verified primitive memberships within direct capabilities. SwordWeave checks the player's role and every exact pin.",
        annotations: readOnly, inputSchema: editToolInput, _meta: toolSecurity(MCP_SCOPES.read),
      }, input => withActor(MCP_SCOPES.read, async actor => {
        if (input.intent === "propose") {
          if (!cursorSecret || config.privateTest) return failure("Proposal tools are unavailable.", "UNAVAILABLE");
          const { rationale: _rationale, ...fields } = input;
          const data = await previewCharacterProposal(actor, previewCharacterProposalInput.parse(fields), { resource: config.resource, cursorSecret });
          return result(data, data.blockers.length ? data.blockers.join("\n") : `Previewed ${data.changes.length} proposed changes to [the character](${data.sheetUrl}).`);
        }
        const { rationale, ...fields } = input;
        if (rationale !== undefined) return failure("Omit rationale for a direct apply. Proposals accept a rationale.", "VALIDATION_FAILED");
        const data = await previewCharacterEdit(actor, previewCharacterEditInput.parse(fields), config);
        if (!data.budgetDelta || data.blockers.length) return result(data, data.blockers.join("\n"));
        const { before, after } = data.budgetDelta;
        return result(data, [
          `Previewed ${data.changes.length} edits to [the character](${data.sheetUrl}).`,
          `Progression Build Units spent ${before.spent} → ${after.spent}. Remaining after the edit: ${after.remaining}.`,
          "The build edit preserves saved Current Vitality, consequences, and Player Notes. Derived sheet statistics can change.",
        ].join("\n\n"));
      }));
    }
    if (characterToolsEnabled(config, "PLAY", "READ")) {
      server.registerTool("read_character_play_state", {
        description: "Read one selected character's Current and Maximum Vitality. Owners also get visible active consequences and authorized consequence package source keys.",
        inputSchema: characterContextInput, annotations: readOnly, _meta: toolSecurity(MCP_SCOPES.read),
      }, input => withActor(MCP_SCOPES.read, async actor => {
        const data = await readCharacterPlayState(actor, input, config);
        const lines = [`**${data.characterName}** · Vitality ${data.currentVitality ?? "unavailable"} / ${data.maxVitality ?? "unavailable"}.`];
        if (data.consequences?.length) lines.push(`Active consequences · ${data.consequences.map(entry => `${entry.title} (${entry.duration.replaceAll("_", " ")})`).join(", ")}.`);
        if (data.sourceChoices?.length) lines.push(`Available consequence packages · ${data.sourceChoices.map(choice => choice.name).join(", ")}.`);
        lines.push(`[Open the character sheet](${data.sheetUrl})${data.partial ? " for additional context" : ""}.`);
        return result(data, lines.join("\n\n"));
      }));
      server.registerTool("preview_session_note", {
        description: "Preview a Markdown addition to Player Notes that the linked player can edit.",
        annotations: readOnly, inputSchema: previewSessionNoteInput, _meta: toolSecurity(MCP_SCOPES.read),
      }, input => withActor(MCP_SCOPES.read, async actor => {
        const data = await previewSessionNote(actor, input, config);
        return result(data, `Proposed addition to Player Notes for ${data.characterName}\n\n${data.text}`);
      }));
      server.registerTool("preview_play_action", {
        description: "Preview Current Vitality for an editor, or as owner record or resolve a consequence or apply an authorized consequence package.",
        annotations: readOnly, inputSchema: previewPlayActionInput, _meta: toolSecurity(MCP_SCOPES.read),
      }, input => withActor(MCP_SCOPES.read, async actor => {
        const data = await previewPlayAction(actor, input, config);
        if (!data.after) return result(data, [...data.blockers, `[Open the character sheet](${data.sheetUrl}).`].join("\n\n"));
        if ("occurrences" in data.after && "currentVitality" in data.after) {
          const count = data.after.occurrences.length;
          return result(data, `${data.characterName} · Apply ${count} ${count === 1 ? "consequence" : "consequences"} · Current Vitality ${data.after.currentVitality}`);
        }
        if (data.before && "currentVitality" in data.before && "currentVitality" in data.after) {
          return result(data, `${data.characterName} · Current Vitality ${data.before.currentVitality} → ${data.after.currentVitality}`);
        }
        return result(data, `${data.characterName} · ${data.actionKind === "record_consequence" ? "Record" : "Resolve"} consequence`);
      }));
    }

    const hasReviewedSave = config.writeEnabled && browserReviewEnabled(config);
    const canPreparePieces = hasReviewedSave && configuredScopes(config).includes(MCP_EDIT_SCOPE);
    server.registerTool("preview_character", {
      description: [
        "Preview a first character. Start with verb tiers, domains, ranges and output die types. Show free Touch and 1d4 when used. Review optional mirrored drawbacks and BU after basic access. The starter takes primitives and primitive-member capabilities.",
        ...(canPreparePieces ? ["Use prepare_character_piece after saving the starter for new effects, heritages, items or capabilities that include effects."] : []),
        ...(!hasReviewedSave ? ["This connection previews builds. Send players to the SwordWeave website to create or edit a saved sheet."] : []),
        "Offer prepare_portrait_prompt as an optional follow-up. An eligible pinned primitive or primitive-member capability can be forked privately. Omit members to retain a capability's slots, or provide the full replacement list. Each capability primitive needs a native role and a pin or draft piece key.",
      ].join(" "),
      inputSchema: previewCharacterInput, annotations: readOnly, _meta: { ...toolSecurity(MCP_SCOPES.read), ...characterReviewToolMeta },
    }, ({ draft }) => withActor(MCP_SCOPES.read, async actor => {
      const data = await previewCharacter(draft, actor);
      const message = creationMessage(data);
      const workshopUrl = new URL("/characters/new", config.resource).href;
      const content = hasReviewedSave ? message : `${message}\n\n[Create the character in SwordWeave](${workshopUrl}).`;
      return { ...result(data, content), _meta: characterReviewResultMeta(data) };
    }));

    if (browserReviewEnabled(config)) {
      server.registerTool("get_operation_status", {
        description: "Recover the status and authorized links for a previously prepared SwordWeave operation.",
        inputSchema: operationInput, annotations: readOnly, _meta: toolSecurity(MCP_SCOPES.read),
      }, ({ operationId }) => withActor(MCP_SCOPES.read, async actor => {
        const data = await getOperationStatus(actor, operationId);
        return result(data, operationMessage(data));
      }));
      if (config.writeEnabled) {
        server.registerTool("prepare_character_save", {
          description: "Prepare a private, pinned character review. Ask the player to review and approve it in SwordWeave before continuing.",
          inputSchema: previewCharacterInput.extend({ supersedesOperationId }),
          annotations: { ...reviewedWrite, idempotentHint: false }, _meta: toolSecurity(...createScopes),
        }, ({ draft, supersedesOperationId }) => withActor(createScopes, async actor => {
          const { preview, prepared } = await preparePinnedCharacterCreation(draft, actor);
          if (!prepared) return result({ ...preview, canPrepare: false }, creationMessage(preview));
          const review = await prepareOperation({ actor, kind: "character_create", subject: { kind: "creation_series" },
            summary: preview, payload: prepared, steps: creationStepKinds(prepared), ...(supersedesOperationId ? { supersedesOperationId } : {}) });
          return result(review, `${creationMessage(preview)}\n\n[Review the private character save](${review.approvalUrl}).`);
        }));
        server.registerTool("continue_character_save", {
          description: "Advance the exact approved private character save at the player's request. Use the next step ID from get_operation_status for a multi-step save. Reuse the same ID after an uncertain response.",
          inputSchema: operationInput.extend({ stepId: operationUuid.optional() }), annotations: reviewedWrite, _meta: toolSecurity(...createScopes),
        }, ({ operationId, stepId }) => withActor(createScopes, async actor => {
          if (!stepId) {
            const status = await getOperationStatus(actor, operationId);
            if (status.kind !== "character_create") throw new OperationUnavailableError();
            if (status.state === "approved" && status.steps.length > 1) {
              return { ...failure("Use the next step ID for this approved character save.", "STEP_REQUIRED"),
                structuredContent: { code: "STEP_REQUIRED", operationId, nextStep: status.nextStep } };
            }
          }
          const data = await executeApprovedOperation({ actor, operationId, expectedKind: "character_create", ...(stepId ? { stepId } : {}), execute: async ({ payload, operationId, step }) => {
            const prepared = preparedCreation.safeParse(payload);
            if (!prepared.success || !step) throw new OperationBlockError("UNSUPPORTED_STEP");
            try {
              return await performPinnedCharacterCreationStep(prepared.data, actor, operationId, step.kind);
            } catch (error) {
              if (error instanceof StaleCharacterCreationError) throw new OperationBlockError("STALE_REVIEW");
              if (error instanceof CharacterPrimitiveConflictError || error instanceof CharacterCapabilityConflictError) throw new OperationBlockError("CONFLICT");
              throw error;
            }
          } });
          return result(data, operationMessage(data));
        }));
        server.registerTool("prepare_progression_pdf", {
          description: "Prepare a private PDF of future progression ideas. Open the review to approve the export before downloading.",
          inputSchema: z.strictObject({ title: z.string().trim().min(1).max(200), ideas: z.array(z.string().trim().min(1).max(500)).min(1).max(10), supersedesOperationId }),
          annotations: { ...reviewedWrite, idempotentHint: false }, _meta: toolSecurity(...createScopes),
        }, ({ title, ideas, supersedesOperationId }) => withActor(createScopes, async actor => {
          const data = await prepareOperation({ actor, kind: "progression_pdf", subject: { kind: "progression_series" },
            summary: { title, ideaCount: ideas.length }, payload: {}, document: { title, ideas }, ...(supersedesOperationId ? { supersedesOperationId } : {}) });
          return result(data, `[Review and approve the progression PDF](${data.approvalUrl}).`);
        }));
        server.registerTool("prepare_progression_note", {
          description: "Prepare a separate, explicit approval to append an approved progression plan to a character's Player Notes.",
          inputSchema: progressionNoteInput, annotations: { ...reviewedWrite, idempotentHint: false }, _meta: toolSecurity(...createScopes),
        }, input => withActor(createScopes, async actor => {
          const data = await prepareProgressionNote(actor, input);
          return result(data, `[Review the exact Player Notes addition](${data.approvalUrl}).`);
        }));
        server.registerTool("save_progression_note", {
          description: "Append the exact approved progression note when the player asks to continue.",
          inputSchema: operationInput, annotations: reviewedWrite, _meta: toolSecurity(...createScopes),
        }, ({ operationId }) => withActor(createScopes, async actor => {
          const data = await saveProgressionNote(actor, operationId);
          return result(data, operationMessage(data));
        }));
      }
      if (configuredScopes(config).includes(MCP_EDIT_SCOPE)) {
        if (cursorSecret) server.registerTool("find_monster_components", {
          description: "Find exact Bestiary component pins among public, owned, or eligible followers-only creations. Use this search for monster builds, including templated primitives. Quote costs with preview_monster_companion before preparing a save.",
          inputSchema: findCreationsInput, annotations: readOnly, _meta: toolSecurity(MCP_SCOPES.read),
        }, input => withActor(MCP_SCOPES.read, async actor => {
          const data = await findCreations(input, actor, { resource: config.resource, cursorSecret, monster: true });
          return result(data, data.items.map(item => item.name).join("\n") || "No matching monster components.");
        }));
        server.registerTool("preview_monster_companion", {
          description: "Price a private Bestiary monster built from exact catalogue versions. Choose the complete mechanics first, then use the resolved Build Units, weakness credit, Item BU, rank and Vitality to fit a budget. This preview saves nothing.",
          inputSchema: previewCompanionInput, annotations: readOnly, _meta: toolSecurity(MCP_SCOPES.read),
        }, input => withActor(MCP_SCOPES.read, async actor => {
          const data = await previewCompanion(actor, input);
          return result(data, `${data.name}: ${data.spentBu} BU, ${data.itemBu} Item BU, ${data.startingVitality} starting Vitality.`);
        }));
        server.registerTool("prepare_monster_companion_save", {
          description: "Prepare a reviewed private Bestiary template and attach its independent play copy to a character you own. Read the current character revision and verify exact component pins first. Ask the player to open and approve the SwordWeave review.",
          inputSchema: prepareCompanionInput, annotations: { ...reviewedWrite, idempotentHint: false }, _meta: toolSecurity(...pieceScopes),
        }, input => withActor(pieceScopes, async actor => {
          const data = await prepareCompanion(actor, input);
          return result(data, `[Review the private Bestiary save and companion attachment](${data.approvalUrl}).`);
        }));
        server.registerTool("apply_monster_companion_save", {
          description: "Save the exact approved private Bestiary template and attach its independent play copy. Retry with the same operation ID after an uncertain response. After saving, use list_character_companions for the play sheet and character PDF.",
          inputSchema: operationInput, annotations: reviewedWrite, _meta: toolSecurity(...pieceScopes),
        }, ({ operationId }) => withActor(pieceScopes, async actor => {
          const data = await applyCompanion(actor, operationId);
          const receipt = companionCreationReceipt.safeParse(data.receipt).data;
          const monster = receipt
            ? ` [Open the pinned Bestiary sheet](${companionBestiaryUrl(config.resource, receipt.monsterId, receipt.version)}).` : "";
          return result(data, operationMessage(data) + monster);
        }));
        server.registerTool("prepare_character_advancement", {
          description: "Prepare the owner's exact level advancement for review. Use a current character revision and the player's explicitly requested target level. Ask the player to open and approve the review before applying it.",
          inputSchema: prepareCharacterAdvancementInput, annotations: { ...reviewedWrite, idempotentHint: false }, _meta: toolSecurity(...editScopes),
        }, input => withActor(editScopes, async actor => {
          const data = await prepareCharacterAdvancement(actor, input);
          return result(data, `${advancementMessage(data.summary)}\n\n[Review the level advancement in SwordWeave](${data.approvalUrl}).`);
        }));
        server.registerTool("apply_character_advancement", {
          description: "Apply the exact level advancement already approved by the character owner. Retry using the same operation ID to recover the original result.",
          inputSchema: operationInput, annotations: reviewedWrite, _meta: toolSecurity(...editScopes),
        }, ({ operationId }) => withActor(editScopes, async actor => {
          const data = await applyApprovedAdvancement(actor, operationId);
          return result(data, operationMessage(data));
        }));
        server.registerTool("prepare_character_piece", {
          title: "Review creating and attaching a private piece",
          description: "Prepare one new private primitive, effect, capability, heritage, or item for a character you own. Use the current sheet revision and exact current member pins. Effects take primitives. Capabilities take primitives with roles and effects. Heritages take primitives and capabilities, and their kind must match the sheet channel. Items go in ITEM and take primitives, effects and capabilities. Show the exact piece and its budget before review in SwordWeave.",
          inputSchema: prepareCharacterPieceInput, annotations: { ...reviewedWrite, idempotentHint: false }, _meta: toolSecurity(...pieceScopes),
        }, input => withActor(pieceScopes, async actor => {
          const data = await prepareCharacterPiece(actor, input);
          const { piece, budget } = data.summary;
          return result(data, `Create and attach **${piece.name}** as a private ${piece.kind}. Character BU spent ${budget.before.spent} → ${budget.after.spent}, ${budget.after.remaining} remaining. Item BU spent ${budget.before.itemBuSpent} → ${budget.after.itemBuSpent}. [Review the exact purchase in SwordWeave](${data.approvalUrl}).`);
        }));
        server.registerTool("apply_character_piece", {
          title: "Create and attach the approved private piece",
          description: "Create and attach the exact private piece already approved by the character owner. Retry with the same operation ID to recover the original piece and version IDs.",
          inputSchema: operationInput, annotations: reviewedWrite, _meta: toolSecurity(...pieceScopes),
        }, ({ operationId }) => withActor(pieceScopes, async actor => {
          const data = await applyCharacterPiece(actor, operationId);
          return result(data, operationMessage(data));
        }));
        server.registerTool("prepare_character_edit", {
          description: "Prepare a review to apply character edits or propose supported foundation, placement, or nested capability changes to the owner. Include rationale only for a proposal.",
          annotations: { ...reviewedWrite, idempotentHint: false }, inputSchema: editToolInput.extend({ supersedesOperationId }), _meta: toolSecurity(...editScopes),
        }, input => withActor(editScopes, async actor => {
          if (input.intent === "propose") {
            if (!cursorSecret || config.privateTest) return failure("Proposal tools are unavailable.", "UNAVAILABLE");
            const data = await prepareCharacterProposal(actor, prepareCharacterProposalInput.parse(input));
            return result(data, `[Review the exact proposal before submitting it](${data.approvalUrl}).`);
          }
          const { rationale, ...fields } = input;
          if (rationale !== undefined) return failure("Omit rationale for a direct apply. Proposals accept a rationale.", "VALIDATION_FAILED");
          const data = await prepareCharacterEdit(actor, prepareCharacterEditInput.parse(fields));
          return result(data, `[Review the exact character edits](${data.approvalUrl}).`);
        }));
        server.registerTool("apply_character_edit", {
          description: "Apply the exact approved character edits at the player's request.",
          annotations: reviewedWrite, inputSchema: applyCharacterEditInput, _meta: toolSecurity(...editScopes),
        }, input => withActor(editScopes, async actor => {
          const data = await applyCharacterEdit(actor, input);
          return result(data, operationMessage(data));
        }));
        if (cursorSecret && !config.privateTest) {
          const versionWrites = versionProposalWritesEnabled(config);
          const proposalContext = { resource: config.resource, cursorSecret, versionProposalReads: versionWrites };
          if (versionWrites) {
            server.registerTool("prepare_version_proposal", {
              description: "Prepare a proposal to change the version of one eligible pinned slot. Use its exact path from the character build. Show the review before submitting.",
              annotations: { ...reviewedWrite, idempotentHint: false }, inputSchema: prepareVersionProposalInput, _meta: toolSecurity(...editScopes),
            }, input => withActor(editScopes, async actor => {
              const data = await prepareVersionProposal(actor, input);
              return result(data, `[Review the proposed slot version](${data.approvalUrl}).`);
            }));
          }
          server.registerTool("submit_character_proposal", {
            description: "Submit the exact approved character proposal for the owner to review.",
            annotations: reviewedWrite, inputSchema: submitCharacterProposalInput, _meta: toolSecurity(...editScopes),
          }, input => withActor(editScopes, async actor => {
            const kind = versionWrites ? (await getOperationStatus(actor, input.operationId)).kind : "character_proposal_submit";
            const data = kind === "character_version_proposal_submit" ? await submitVersionProposal(actor, input) : await submitCharacterProposal(actor, input);
            return result(data, data.state === "completed" && data.sheetUrl ? `[Proposal submitted](${data.sheetUrl}).` : operationMessage(data));
          }));
          server.registerTool("prepare_proposal_decision", {
            description: "Prepare an exact proposal decision. The owner can approve or reject. An author can withdraw their workspace proposal.",
            annotations: { ...reviewedWrite, idempotentHint: false }, inputSchema: prepareProposalDecisionInput, _meta: toolSecurity(...editScopes),
          }, input => withActor(editScopes, async actor => {
            let versionProposal = false;
            if (versionWrites) {
              try {
                resolveVersionProposalRef(actor, input.characterId, input.proposalRef, proposalContext);
                versionProposal = true;
              } catch (error) {
                if (!(error instanceof CharacterProposalUnavailable)) throw error;
              }
            }
            const versionInput = versionProposal ? prepareVersionProposalDecisionInput.safeParse(input) : null;
            if (versionInput && !versionInput.success) return failure("Version proposals support approval or rejection with a note of up to 1,000 characters.", "VALIDATION_FAILED");
            const data = versionInput
              ? await prepareVersionProposalDecision(actor, versionInput.data, proposalContext)
              : await prepareProposalDecision(actor, input, proposalContext);
            return result(data, `[Review the proposed decision](${data.approvalUrl}).`);
          }));
          server.registerTool("review_character_proposal", {
            description: "Execute the approved character proposal decision at the player's request.",
            annotations: reviewedWrite, inputSchema: reviewCharacterProposalInput, _meta: toolSecurity(...editScopes),
          }, input => withActor(editScopes, async actor => {
            const kind = versionWrites ? (await getOperationStatus(actor, input.operationId)).kind : "character_proposal_decide";
            const data = kind === "character_version_proposal_decide" ? await reviewVersionProposal(actor, input) : await reviewCharacterProposal(actor, input);
            return result(data, operationMessage(data));
          }));
        }
      }
      if (configuredScopes(config).includes(MCP_PLAY_SCOPE)) {
        server.registerTool("prepare_session_note", {
          description: "Prepare a review of the exact Markdown addition to Player Notes.",
          annotations: { ...reviewedWrite, idempotentHint: false }, inputSchema: prepareSessionNoteInput, _meta: toolSecurity(...playScopes),
        }, input => withActor(playScopes, async actor => {
          const data = await prepareSessionNote(actor, input);
          return result(data, `[Review the Player Notes addition](${data.approvalUrl}).`);
        }));
        server.registerTool("save_session_note", {
          description: "Append the exact approved session note at the player's request.",
          annotations: reviewedWrite, inputSchema: saveSessionNoteInput, _meta: toolSecurity(...playScopes),
        }, input => withActor(playScopes, async actor => {
          const data = await saveSessionNote(actor, input);
          return result(data, operationMessage(data));
        }));
        server.registerTool("prepare_play_action", {
          description: "Prepare a review of one Vitality change or consequence action, including a supported owner-authorized package.",
          annotations: { ...reviewedWrite, idempotentHint: false }, inputSchema: preparePlayActionInput, _meta: toolSecurity(...playScopes),
        }, input => withActor(playScopes, async actor => {
          const data = await preparePlayAction(actor, input);
          return result(data, `[Review the play action](${data.approvalUrl}).`);
        }));
        server.registerTool("apply_play_action", {
          description: "Apply the exact approved play action at the player's request.",
          annotations: reviewedWrite, inputSchema: applyPlayActionInput, _meta: toolSecurity(...playScopes),
        }, input => withActor(playScopes, async actor => {
          const data = await applyPlayAction(actor, input);
          return result(data, operationMessage(data));
        }));
      }
    }
  }
  return server;
}
