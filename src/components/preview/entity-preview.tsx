"use client";

// =============================================================================
// EntityPreview — THE unified preview for every SwordWeave entity, rendered
// identically in My Creations, Library, the Atelier sandbox library, and the
// Atelier build-modal preview tab.
//
// variant:
//   "read"  — full surface (header + sections + engagement footer w/ like /
//             fork / version history). Used by library, creations, sandbox.
//   "build" — same body, but the action footer is replaced by Save + Reset
//             (the build modal owns those) and engagement controls are hidden.
//
// The body is a single source of truth. No more per-surface drift: the
// modifiers render as structured cards with a color-coded OperationBadge,
// the "When:" condition line (AND/OR pills), and a MirrorPanel that shows
// the inverse operation. The legacy `mirrorVector` string is intentionally
// NOT displayed.
// =============================================================================

import { lineageArtUrl } from "@/lib/heritage/lineage-art";
import { useEffect, useState, type ReactNode } from "react";
import { Markdown } from "@/components/ui/markdown";
import { MechanicalSummary } from "./mechanical-summary";
import { useIsMobile } from "@/lib/hooks/use-is-mobile";
import { IconDisplay } from "@/components/icons/icon-display";
import { LikeForkBar } from "@/components/engagement/like-fork-bar";
import { PreviewFlagSummary } from "@/components/engagement/flags-section";
import { ForkMapButton } from "@/components/engagement/fork-map-button";
import type { ForkTargetType } from "@/lib/publishing/forks-query";
import { ChevronRight, History } from "lucide-react";
import { useModalStack } from "@/components/ui/modal-stack";
import { computeTransitiveBu } from "@/lib/engine/transitive-bu";
import { SIZE_LOAD } from "@/lib/engine/encumbrance";
import { OP_SPECS, type ModifierOperation } from "@/types/modifier";
import {
  OperationBadge,
  Section,
  VersionChip,
  VisibilityPill,
  ConditionLine,
  opLabel,
  PreviewActions,
  type PreviewActionProps,
  type PreviewSubLink,
  type PreviewCallbacks,
} from "./preview-shared";
export type { PreviewActionProps } from "./preview-shared";
import {
  type SandboxPreviewItem,
  type SandboxPrimitiveRow,
  type SandboxEffectRow,
  type SandboxCapabilityRow,
  type SandboxTemplateRow,
  type SandboxItemRow,
  libraryCompositeId,
} from "@/components/library/library-item-preview";
import { humanizeMechanicalTarget } from "@/components/characters/operator-symbol";
import { mechanicalDescriptionFromModifiers } from "@/lib/primitives/mechanical-rule";
import type { HardModifier } from "@/types/swordweave";

// Prettify a stored modifier value. The primitive form persists values in a
// compact syntax like `behavior:/240/[ft]` (target : value : unit). Render it
// humanly as `240 ft` so the preview reads cleanly instead of dumping the raw
// string. Falls back to the raw value for anything it doesn't recognise.
function prettifyModifierValue(raw: string): string {
  const trimmed = raw.trim();
  // Pattern: <target>:/<value>/[<unit>]  e.g. behavior:/240/[ft]
  // Tolerant of stray whitespace (some stored values are
  // `behavior:/240/ [ft]` with a space before the unit bracket).
  const m = /^[^:]+:\s*\/([^/]+)\/\s*(?:\[([^\]]*)\])?\s*$/.exec(trimmed);
  if (m) {
    const value = m[1]?.trim() ?? "";
    const unit = m[2]?.trim() ?? "";
    return unit ? `${value} ${unit}` : value;
  }
  return trimmed;
}

/** Translate persisted rule tokens into the language used by the sheet. */
function humanizeRuleToken(raw: string): string {
  const normalized = raw.trim().replace(/^\/+|\/+$/g, "");
  const known: Record<string, string> = {
    pb: "Proficiency bonus",
    action_roll: "Action roll",
    attack_roll: "Attack roll",
    damage_roll: "Damage roll",
    save_dc: "Save DC",
    practice_proficiency: "Practice proficiency",
    unique_by_primitive: "Unique per primitive",
    highest_only: "Highest value only",
    lowest_only: "Lowest value only",
    no_stack: "Does not stack",
    stack: "Stacks",
  };
  const key = normalized.toLowerCase().replace(/[\s-]+/g, "_");
  if (known[key]) return known[key];
  return normalized
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_.-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (letter) => letter.toUpperCase());
}

function ModifierRuleSentence({ op, value, target }: { op: string; value: string; target: string }) {
  const operation = opLabel(op as ModifierOperation);
  const valueLabel = humanizeRuleToken(value);
  const targetLabel = humanizeMechanicalTarget(target || "value");
  const parts = (() => {
    switch (op) {
      case "set": return [operation, targetLabel, "to", valueLabel];
      case "min": return ["Set minimum", targetLabel, "to", valueLabel];
      case "max": return ["Set maximum", targetLabel, "to", valueLabel];
      case "multiply": return [operation, targetLabel, "by", valueLabel];
      case "divide": return [operation, targetLabel, "by", valueLabel];
      case "subtract": return [operation, valueLabel, "from", targetLabel];
      case "revoke": return [operation, valueLabel, "from", targetLabel];
      default: return [operation, valueLabel, "to", targetLabel];
    }
  })();
  return (
    <div className="v12-behavior-rule" aria-label={parts.join(" ")}>
      <span>{parts[0]}</span>
      <strong>{parts[1]}</strong>
      <span>{parts[2]}</span>
      <strong>{parts[3]}</strong>
    </div>
  );
}

export type EntityPreviewVariant = "read" | "build";

export type EntityPreviewOwner = {
  authorId: string | null;
  authorUsername: string | null;
  authorDisplayName?: string | null;
  authorAvatarUrl?: string | null;
  isOwner: boolean;
  /** Profile page URL (e.g. /u/username). When set, the author name +
   *  avatar become a link to the profile. */
  profileHref?: string | null;
  /** Optional "Source: <origin>" pill rendered on the right of the
   *  owner row. Carries the same value as the build-edit "Source
   *  origin" field (world, book, setting). */
  sourceOrigin?: string | null;
};

export type EntityPreviewActions = {
  onEdit?: () => void;
  onDelete?: () => void;
  openSourceHref?: string;
  versionHistoryHref?: string;
};

export interface EntityPreviewProps {
  item: SandboxPreviewItem;
  variant?: EntityPreviewVariant;
  callbacks?: PreviewCallbacks | undefined;
  /**
   * Ownership + author metadata. When provided, the preview shows the
   * owner ("by @user") with avatar, and — if `isOwner` — the
   * owner highlight. Keeps the action bar identical across every
   * surface (creations, library, sandbox, atelier).
   */
  owner?: EntityPreviewOwner | undefined;
  /** Hide the owner strip when the surrounding page already renders authorship. */
  showOwner?: boolean;
  /** Hide the inner identity block when a containing source page owns it. */
  showIdentity?: boolean;
  /**
   * Action bar (Edit / Open source / Version history / Delete). Every
   * preview surface renders the SAME row in the SAME order so the modal
   * looks identical regardless of where it was opened from.
   */
  actions?: EntityPreviewActions;
  /**
   * Full set of action-bar props (Edit / Source / Versions / Delete /
   * visibility). When provided, THE SAME shared `PreviewActions` bar is
   * rendered as in My Creations — guaranteeing identical layout/order
   * across every surface. Prefer passing `actions` (the higher-level
   * object) over the deprecated individual fields below.
   */
  actionBar?: PreviewActionProps | undefined;
  /** Place insertion controls before long preview content in constrained tools. */
  actionPlacement?: "top" | "bottom" | undefined;
  /** build variant only: Save / Reset handlers + labels. */
  onSave?: () => void;
  onReset?: () => void;
  saveLabel?: string;
  resetLabel?: string;
  isDirty?: boolean;
  /**
   * Live build draft modifiers (primitive form). When provided AND the
   * item is a primitive, the modifier cards render from this (richer:
   * equations, scope, structured conditions) instead of the stored
   * `row.hardModifiers`. Keeps the build-modal preview identical to the
   * library one while still showing the live draft.
   */
  buildModifiers?: Array<Record<string, unknown>>;
}

// ---- per-kind section label ------------------------------------------------

function sectionLabel(item: SandboxPreviewItem): string {
  switch (item.kind) {
    case "primitive":
      return "Primitive";
    case "effect":
      return "Effect";
    case "capability":
      return `Capability · ${item.row.type}`;
    case "heritage":
      return `Template · ${item.row.kind}`;
    case "item":
      return `Item · ${item.row.itemType}`;
  }
}

// ---- icon header tile -------------------------------------------------------

function IconTile({ row }: { row: { iconSource: string | null; iconKey: string | null; iconUrl: string | null; iconColor: string; fallback: string } }) {
  if (row.iconSource) {
    return (
      <IconDisplay
        iconSource={row.iconSource as "GAME_ICONS" | "UPLOAD"}
        iconKey={row.iconKey}
        iconUrl={row.iconUrl}
        iconColor={row.iconColor}
        size={40}
        className="shrink-0"
        alt=""
      />
    );
  }
  const icon = ({ PRI: "delapouite/cube", EFF: "lorc/cubes", CAP: "lorc/cubeforce", LIN: "lorc/dna2", UPB: "delapouite/plant-roots", MAN: "caro-asercion/tarot-11-justice", ITEM: "lorc/battle-gear" } as Record<string,string>)[row.fallback.toUpperCase()] ?? "delapouite/cube";
  return <IconDisplay iconSource="GAME_ICONS" iconKey={icon} iconColor="#64c7c1" size={40} className="shrink-0" alt="" />;

}

// ---- composed-entity drill-down list (primitives/effects/caps/items) -------

function ComposedList({
  title,
  items,
  onSubLink,
}: {
  title: string;
  items: Array<{
    id: string;
    name: string;
    meta?: ReactNode;
    bu: number;
    versionNumber?: number | null | undefined;
    entityKind?: "primitive" | "effect" | "capability" | "item";
    subText?: ReactNode;
    note?: string | null;
    noteRole?: "mechanical" | "narrative";
    // Phase 8.1 batch 13.2 follow-up: per-item targetType so the
    // preview modal knows whether to fetch a primitive, capability,
    // effect, or item when the user clicks the row. Previously the
    // component always fired `targetType: "PRIMITIVE"`, which meant
    // clicking a bundled capability from a heritage preview did
    // nothing useful (the modal opened with the wrong targetType).
    // Mashu 2026-07-22: "in view atelier if i click on a bundled
    // capability, it does not open the preview modal for that like
    // it does for effects or primitives."
    targetType?: "PRIMITIVE" | "CAPABILITY" | "EFFECT" | "ITEM";
  }>;
  onSubLink?: (link: PreviewSubLink) => void;
}) {
  if (items.length === 0) return null;
  return (
    <Section heading={title}>
      <ul className="v12-composed-ledger">
        {items.map((it, index) => (
          <li
            // The same primitive may deliberately appear more than once
            // through separate roles or quantities. Its database id alone
            // is therefore not a list identity.
            key={`${it.targetType ?? "PRIMITIVE"}:${it.id}:${index}`}
            role={onSubLink ? "button" : undefined}
            tabIndex={onSubLink ? 0 : undefined}
            onClick={
              onSubLink
                ? () =>
                    onSubLink({
                      targetType: it.targetType ?? "PRIMITIVE",
                      targetId: it.id,
                      label: it.name,
                    })
                : undefined
            }
            onKeyDown={
              onSubLink
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSubLink!({
                        targetType: it.targetType ?? "PRIMITIVE",
                        targetId: it.id,
                        label: it.name,
                      });
                    }
                  }
                : undefined
            }
            className={`v12-composed-ledger-row${onSubLink ? " is-actionable" : ""}`}
            data-entity-kind={it.entityKind ?? "primitive"}
            aria-label={onSubLink ? `Preview ${it.entityKind ?? "primitive"}: ${it.name}` : undefined}
          >
            <div className="v12-composed-ledger-index" aria-hidden="true">
              <span className="font-mono text-[8px] font-bold uppercase tracking-widest text-muted-foreground">
                {(it.entityKind ?? "primitive").slice(0, 3)}
              </span>
            </div>
            <div className="v12-composed-ledger-copy">
              <div className="v12-composed-ledger-titleline flex min-w-0 items-center gap-1.5">
                <span className="v12-composed-ledger-name min-w-0 flex-1">{it.name}</span>
                <VersionChip versionNumber={it.versionNumber} />
              </div>
              {it.note ? <Markdown copyRole={it.noteRole ?? "narrative"} className="v12-composed-ledger-rule line-clamp-2">{it.note}</Markdown> : null}
              {it.subText ? <div className="v12-composed-ledger-source">{it.subText}</div> : null}
            </div>
            <span className="v12-composed-ledger-bu"><b>{it.bu}</b><small>BU</small></span>
            {onSubLink ? <ChevronRight className="v12-composed-ledger-arrow" /> : null}
          </li>
        ))}
      </ul>
    </Section>
  );
}

type CompositionNode = {
  id: string;
  name: string;
  kind: "primitive" | "effect" | "capability" | "item";
  targetType: "PRIMITIVE" | "EFFECT" | "CAPABILITY" | "ITEM";
  bu: number;
  versionNumber?: number | null | undefined;
  meta?: ReactNode;
  note?: string | null | undefined;
  noteRole?: "mechanical" | "narrative" | undefined;
  children?: CompositionNode[] | undefined;
};

/** Nested primitive cards are reading surfaces, not database inspectors.
 * API relations generally return the complete primitive row, while the
 * public preview types intentionally describe only their required fields.
 * Read the optional prose defensively so older compact payloads still work. */
function primitiveCardCopy(primitive: { category: string }): string | null {
  const record = primitive as typeof primitive & {
    mechanicalOutputText?: string | null;
    narrativeRule?: string | null;
  };
  return record.mechanicalOutputText?.trim()
    || record.narrativeRule?.trim()
    || null;
}

function primitiveCopyRole(primitive: { category: string }): "mechanical" | "narrative" {
  return (primitive as { mechanicalOutputText?: string | null }).mechanicalOutputText?.trim() ? "mechanical" : "narrative";
}

function CompositionTree({
  title,
  nodes,
  onSubLink,
}: {
  title: string;
  nodes: CompositionNode[];
  onSubLink: (link: PreviewSubLink) => void;
}) {
  const phone = useIsMobile();
  const [trail, setTrail] = useState<CompositionNode[]>([]);
  if (nodes.length === 0) return null;
  if (phone) {
    const liveTrail: CompositionNode[] = [];
    let visibleNodes = nodes;
    for (const step of trail) {
      const match = visibleNodes.find(node => node.id === step.id && node.targetType === step.targetType);
      if (!match?.children?.length) break;
      liveTrail.push(match);
      visibleNodes = match.children;
    }
    const current = liveTrail.at(-1);
    return <Section heading={`${title} (${nodes.length})`}>
      <div className="sw-phone-composition">
        {current ? <div className="sw-phone-composition-path"><button type="button" onClick={() => setTrail(liveTrail.slice(0, -1))}>← Back</button><strong>{current.name}</strong><button type="button" onClick={() => onSubLink({targetType:current.targetType,targetId:current.id,label:current.name})}>Details</button></div> : null}
        {visibleNodes.map((node, index) => <div className="sw-phone-composition-row" key={`${node.targetType}:${node.id}:${index}`}>
          <button type="button" onClick={() => onSubLink({targetType:node.targetType,targetId:node.id,label:node.name})}>
            <span><strong>{node.name}</strong><b>{node.bu} BU</b></span>
            <small>{node.kind}</small>
            {node.note ? <Markdown copyRole={node.noteRole ?? "narrative"} className="sw-phone-composition-note">{node.note}</Markdown> : null}
          </button>
          {node.children?.length ? <button className="sw-phone-composition-pieces" type="button" onClick={() => setTrail([...liveTrail,node])}>Pieces · {node.children.length} <ChevronRight size={14}/></button> : null}
        </div>)}
      </div>
    </Section>;
  }
  return (
    <Section heading={`${title} (${nodes.length})`}>
      <div className="v12-composition-tree" role="list">
        {nodes.map((node, index) => (
          <CompositionTreeNode key={`${node.targetType}:${node.id}:${index}`} node={node} onSubLink={onSubLink} depth={0} />
        ))}
      </div>
    </Section>
  );
}

function CompositionTreeNode({
  node,
  onSubLink,
  depth,
}: {
  node: CompositionNode;
  onSubLink: (link: PreviewSubLink) => void;
  depth: number;
}) {
  const hasChildren = Boolean(node.children?.length);
  const [expanded, setExpanded] = useState(depth === 0 && node.kind === "capability");
  return (
    <div
      className={`v12-composition-node is-${node.kind}${expanded ? " is-expanded" : ""}`}
      data-entity-kind={node.kind}
      data-depth={depth}
      role="listitem"
    >
      <div className="v12-composition-node-row">
        {hasChildren ? (
          <button
            type="button"
            className="v12-composition-node-toggle"
            aria-label={`${expanded ? "Collapse" : "Expand"} ${node.name}`}
            aria-expanded={expanded}
            onClick={() => setExpanded((current) => !current)}
          >
            <ChevronRight aria-hidden="true" />
          </button>
        ) : <span className="v12-composition-node-spacer" aria-hidden="true" />}
        <span className="v12-composition-node-kind" aria-hidden="true">{node.kind.slice(0, 3)}</span>
        <button
          type="button"
          className="v12-composition-node-main"
          onClick={() => onSubLink({ targetType: node.targetType, targetId: node.id, label: node.name })}
          aria-label={`Preview ${node.kind}: ${node.name}`}
        >
          <span className="v12-composition-node-titleline">
            <span className="v12-composition-node-name">{node.name}</span>
            <VersionChip versionNumber={node.versionNumber} />
          </span>
          {node.note ? <Markdown copyRole={node.noteRole ?? "narrative"} className="v12-composition-node-note line-clamp-2">{node.note}</Markdown> : null}
          {node.meta ? <span className="v12-composition-node-meta">{node.meta}</span> : null}
        </button>
        <span className="v12-composition-node-bu"><b>{node.bu}</b><small>BU</small></span>
        <button
          type="button"
          className="v12-composition-node-preview"
          onClick={() => onSubLink({ targetType: node.targetType, targetId: node.id, label: node.name })}
          aria-label={`Open ${node.name} preview`}
        >
          <ChevronRight aria-hidden="true" />
        </button>
      </div>
      {hasChildren && expanded ? (
        <div className="v12-composition-node-children" role="list">
          {node.children!.map((child, index) => (
            <CompositionTreeNode
              key={`${child.targetType}:${child.id}:${index}`}
              node={child}
              onSubLink={onSubLink}
              depth={depth + 1}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ---- primitive modifier cards ----------------------------------------------

function ModifierCards({
  row,
  buildModifiers,
}: {
  row: SandboxPrimitiveRow;
  buildModifiers?: Array<Record<string, unknown>> | undefined;
}) {
  // Live build draft (from the primitive form) carries the rich ModifierDraft
  // shape: target, operation, value, valueKind, operands (for equations),
  // targetValues / freeTextNarrowFocus (scope), v1Condition, stacking. The
  // stored SandboxPrimitiveRow.hardModifiers is the legacy v1 shape
  // {operation,target,value,condition,stacking}. We render both through one
  // card so the library preview and the build-modal preview are identical.
  type Card = {
    op: string;
    target: string;
    valueText: string;
    stacking: string;
    condition?: unknown;
    scopeValues: string[];
    narrowScope: string;
    sentence?: string;
  };

  const cards: Card[] = (buildModifiers ?? (row.hardModifiers as Array<Record<string, unknown>> | undefined) ?? []).map((m, i): Card => {
    const op = String(m["operation"] ?? "add");
    const target = String(m["target"] ?? "")
      .split(".")
      .pop() ?? String(m["target"] ?? "");
    const stacking = String(m["stacking"] ?? "stack");

    // Rich draft value rendering (equation / text / number) — mirrors the
    // build-modal's modifierBlock.
    let valueText: string;
    // Phase 8.I i2.5h-fix (Mashu 2026-08-06): valueKind is stored
    // in metadata.valueKind (not at the modifier's top level) for
    // modifiers saved through the new form. For legacy v1 rows
    // it's missing entirely. Default to "number" if absent.
    const meta = m["metadata"] as Record<string, unknown> | undefined;
    const valueKind = (m["valueKind"] as string | undefined)
      ?? (meta?.["valueKind"] as string | undefined)
      ?? "number";
    const operands = (m["operands"] as Array<Record<string, unknown>> | undefined)
      ?? (meta?.["operands"] as Array<Record<string, unknown>> | undefined);
    if (valueKind === "equation" && Array.isArray(operands)) {
      // Phase 8.I i2.5h-fix: each operand is {op, value: OperandValue}.
      // value is a typed-token OBJECT (e.g. {kind:"number",value:2}).
      // The previous String(o.value) produced "[object Object]".
      const eqText = operands
        .map((o) => {
          const opSym = String(o["op"] ?? "+");
          const v = o["value"];
          const tokenStr = (() => {
            if (typeof v === "number") return String(v);
            if (typeof v === "string") return v;
            if (v && typeof v === "object") {
              const obj = v as Record<string, unknown>;
              const kind = obj["kind"];
              if (typeof kind !== "string") return String(v);
              switch (kind) {
                case "number": return String(obj["value"] ?? "0");
                case "derived": return String(obj["which"] ?? "");
                case "attribute": return String(obj["attribute"] ?? "");
                case "practice": return String(obj["practice"] ?? "");
                case "behavior": return String(obj["name"] ?? "");
                case "dice": return `#${String(obj["expression"] ?? "")}#`;
                case "keyword": return `[${String(obj["text"] ?? "")}]`;
                case "runtime": return `/${String(obj["name"] ?? "")}/`;
                default: return String(v);
              }
            }
            return String(v ?? "");
          })();
          return `${opSym} ${tokenStr}`;
        })
        .join(" ")
        .replace(/^\+\s*/, "");  // strip leading +
      valueText = eqText || "Empty equation";
    } else if (valueKind === "text") {
      valueText = String(m["value"] ?? "");
    } else {
      const raw =
        m["value"] === undefined || m["value"] === null
          ? null
          : m["value"];
      // Phase 8.I i2.5e (Mashu 2026-08-05): typed tokens (PB chip,
      // /physical/, etc.) are stored as objects. The previous
      // String(raw) yielded "[object Object]" — copy the
      // dispatch helper from primitive-preview-card.tsx.
      let v: string;
      if (typeof raw === "number") {
        v = String(raw);
      } else if (raw === null) {
        v = "0";
      } else if (typeof raw === "string") {
        v = prettifyModifierValue(raw);
      } else if (typeof raw === "object") {
        const obj = raw as Record<string, unknown>;
        const kind = obj["kind"];
        if (typeof kind !== "string") {
          v = "?";
        } else {
          switch (kind) {
            case "number":
              v = String(obj["value"]);
              break;
            case "derived":
              v = String(obj["which"] ?? "");
              break;
            case "attribute":
              v = String(obj["attribute"] ?? "");
              break;
            case "practice":
              v = String(obj["practice"] ?? "");
              break;
            case "behavior":
              v = String(obj["name"] ?? "");
              break;
            case "dice":
              v = String(obj["expression"] ?? "");
              break;
            case "keyword":
              v = `[${String(obj["text"] ?? "")}]`;
              break;
            case "runtime":
              v = `/${String(obj["name"] ?? "")}/`;
              break;
            default:
              v = "?";
          }
        }
      } else {
        v = prettifyModifierValue(String(raw));
      }
      valueText = v;
    }

    // Phase 8.I i2.5e (Mashu 2026-08-05): scope (sub-target) is read
    // from BOTH the draft (targetValues/freeTextNarrowFocus) AND the
    // stored modifier (metadata.targetScope.values +
    // metadata.behaviorName/scopeName). The previous version only
    // read the draft fields, so stored primitives never displayed
    // their sub-targets (PROWESS, PHYSICAL, blockValue, etc.) in the
    // preview.
    const draftTv = (m["targetValues"] as string[] | undefined) ?? [];
    const draftNarrow = String(m["freeTextNarrowFocus"] ?? "");
    // Stored form: metadata.targetScope.values
    let storedTv: string[] = [];
    let storedNarrow = "";
    const storedMeta = m["metadata"] as Record<string, unknown> | undefined;
    if (storedMeta && typeof storedMeta === "object") {
      const scope = storedMeta["targetScope"] as
        | Record<string, unknown>
        | undefined;
      if (scope && typeof scope === "object") {
        const values = scope["values"];
        if (Array.isArray(values)) {
          storedTv = values
            .filter((v): v is unknown => v !== null && v !== undefined)
            .map((v) => String(v));
        }
      }
      const bname = storedMeta["behaviorName"];
      if (typeof bname === "string" && bname.trim().length > 0) {
        storedNarrow = bname.trim();
      } else {
        const sname = storedMeta["scopeName"];
        if (typeof sname === "string" && sname.trim().length > 0) {
          storedNarrow = sname.trim();
        }
      }
    }
    // Draft values take precedence; fall back to stored.
    const tv = draftTv.length > 0 ? draftTv : storedTv;
    const narrow = draftNarrow.length > 0 ? draftNarrow : storedNarrow;
    // The condition prop is passed as-is; the shared parseCondition
    // (inside ConditionLine) understands every stored shape: legacy
    // {key,operator,value}, v1 {kind:"preset"|"tags"|"compound"|
    // "narrative"}, and the build-form {pills,operators,narrative}.
    const condition = m["condition"];

    // Saved mechanics use the same projection as the editor and Library.
    // Conditions have their own readable row immediately below the sentence.
    const sentence = !buildModifiers && typeof m["target"] === "string"
      ? mechanicalDescriptionFromModifiers([{ ...m, condition: undefined } as unknown as HardModifier])
      : undefined;
    return { op, target, valueText, stacking, scopeValues: tv, narrowScope: narrow, condition, ...(sentence ? { sentence } : {}) };
  });

  if (cards.length === 0) {
    const vectorLabel = (row.mirrorVector ?? "NONE").replaceAll("_", " ").toLowerCase();
    return (
      <Section heading="Behavior">
        <div className="v12-behavior-empty">
          {row.isMirrorable
            ? `Mirrorable through the ${vectorLabel} rule${row.mirrorEligibilityNotes ? `: ${row.mirrorEligibilityNotes}` : "."}`
            : "This primitive is not mirrorable."}
        </div>
      </Section>
    );
  }
  return (
    <Section heading="Behavior">
      <ul className="v12-behavior-ledger">
        {cards.map((c, i) => {
          const op = c.op as ModifierOperation;
          // Phase 8.I i2.5h-fix2: derive mirrorability + the
          // mirrored op directly from OP_SPECS. No more emoji +
          // "(sign flip)" string — the chip carries the op
          // signal as an OperationBadge instead.
          const spec = OP_SPECS[op];
          const mirrorable = Boolean(spec?.mirrorable) && Boolean(spec?.mirrorOp);
          const mirrorOp = spec?.mirrorOp as ModifierOperation | undefined;
          return (
            <li key={i} className="v12-behavior-card">
              <div className="v12-behavior-card-head">
                <span className="v12-behavior-operation"><OperationBadge op={op} /> {opLabel(op)}</span>
                <span className={mirrorable ? "v12-behavior-mirror is-mirrorable" : "v12-behavior-mirror"}>
                  {mirrorable && mirrorOp ? <>Mirrors as {opLabel(mirrorOp)}</> : "Mirror locked"}
                </span>
              </div>
              {c.sentence ? <div className="v12-behavior-rule" aria-label={c.sentence}><span>{c.sentence}</span></div> : <ModifierRuleSentence op={c.op} value={c.valueText} target={c.target} />}
              {c.scopeValues.length > 0 || c.narrowScope ? (
                <div className="v12-behavior-scope">
                  <span>Applies to</span>
                  {c.scopeValues.map((value) => <b key={value}>{humanizeRuleToken(value)}</b>)}
                  {c.narrowScope ? <em>{humanizeRuleToken(c.narrowScope)}</em> : null}
                </div>
              ) : null}
              {c.condition ? <div className="v12-behavior-condition"><ConditionLine condition={c.condition} /></div> : null}
              <div className="v12-behavior-meta">
                <span><small>Stacking</small><b>{humanizeRuleToken(c.stacking)}</b></span>
                <span><small>Mirror rule</small>{mirrorable && mirrorOp ? <><OperationBadge op={mirrorOp} /><b>{opLabel(mirrorOp)}</b></> : <b>Locked</b>}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

// ---- main -------------------------------------------------------------------

export function EntityPreview({
  item,
  variant = "read",
  callbacks,
  onSave,
  onReset,
  saveLabel = "Save changes",
  resetLabel = "Reset",
  isDirty = false,
  buildModifiers,
  owner,
  showOwner = true,
  showIdentity = true,
  actions,
  actionBar,
  actionPlacement = "bottom",
}: EntityPreviewProps) {
  const stack = useModalStack();
  const compositeId = libraryCompositeId(item);
  const [previewTargetType, previewTargetId] = compositeId.split(":", 2) as [ForkTargetType, string];
  const [autoEngagement, setAutoEngagement] = useState<NonNullable<PreviewCallbacks["engagement"]>>({
    likes: 0,
    dislikes: 0,
    forks: 0,
    userReaction: null,
    authorId: owner?.authorId ?? null,
    authorUsername: owner?.authorUsername ?? null,
    authorIsAdmin: null,
    currentUserInternalId: null,
  });
  useEffect(() => {
    if (variant !== "read" || callbacks?.engagement) return;
    const controller = new AbortController();
    void fetch(
      `/api/engagement/lookup?targetType=${encodeURIComponent(previewTargetType)}&targetId=${encodeURIComponent(previewTargetId)}`,
      { signal: controller.signal },
    )
      .then(async (response) => response.ok ? response.json() : null)
      .then((data) => {
        if (!data) return;
        setAutoEngagement({
          likes: Number(data.likes ?? 0),
          dislikes: Number(data.dislikes ?? 0),
          forks: Number(data.forks ?? 0),
          userReaction: data.userReaction ?? null,
          authorId: owner?.authorId ?? null,
          authorUsername: owner?.authorUsername ?? null,
          authorIsAdmin: null,
          currentUserInternalId: data.currentUserInternalId ?? null,
        });
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [callbacks?.engagement, owner?.authorId, owner?.authorUsername, previewTargetId, previewTargetType, variant]);
  const resolvedCallbacks: PreviewCallbacks = {
    ...callbacks,
    engagement: callbacks?.engagement ?? autoEngagement,
    openSourceHref: callbacks?.openSourceHref ?? `/library/item/${compositeId}`,
    versionHistoryHref: callbacks?.versionHistoryHref ?? `/library/item/${compositeId}/versions`,
  };
  const resolvedActionBar: PreviewActionProps | undefined = variant === "read"
    ? {
      ...actionBar,
        ...((actionBar?.onEdit ?? actions?.onEdit)
          ? { onEdit: (actionBar?.onEdit ?? actions?.onEdit)! }
          : {}),
        openSourceHref: actionBar?.openSourceHref ?? actions?.openSourceHref ?? `/library/item/${compositeId}`,
        versionHistoryHref: actionBar?.versionHistoryHref ?? actions?.versionHistoryHref ?? `/library/item/${compositeId}/versions`,
        forkMap: (
          actionBar?.forkMap ?? <ForkMapButton
              targetType={previewTargetType}
              targetId={previewTargetId}
              targetName={item.row.name}
              className="min-w-0 flex-1 justify-center px-1.5 py-2 text-xs"
            />
        ),
      }
    : actionBar;
  const onSubLink = (link: PreviewSubLink) => {
    // A nested record is a new layer of context. Prefer the shared stack even
    // when a legacy caller supplied an in-place selection callback; that keeps
    // the current preview mounted beneath the child in Character, Library and
    // the scoped Atelier panel. The callback remains the fallback for surfaces
    // rendered outside ModalStackHost.
    if (resolvedCallbacks.preferLocalSubLinks && resolvedCallbacks.onSubLinkClick) {
      resolvedCallbacks.onSubLinkClick(link);
      return;
    }
    if (stack.canPush) {
      stack.push({
        key: `sublink:${link.targetType}:${link.targetId}`,
        label: link.label,
        category: link.targetType,
        content: <FetchedEntityPreview targetType={link.targetType} targetId={String(link.targetId)} />,
      });
      return;
    }
    resolvedCallbacks.onSubLinkClick?.(link);
  };

  const body = (() => {
    switch (item.kind) {
      case "primitive":
        return <PrimitiveBody row={item.row} onSubLink={onSubLink} buildModifiers={buildModifiers} showIdentity={showIdentity} />;
      case "effect":
        return <EffectBody row={item.row} onSubLink={onSubLink} />;
      case "capability":
        return <CapabilityBody row={item.row} onSubLink={onSubLink} />;
      case "heritage":
        return <TemplateBody row={item.row} onSubLink={onSubLink} />;
      case "item":
        return <ItemBody row={item.row} onSubLink={onSubLink} />;
    }
  })();

  // Derive owner from engagement when the caller didn't pass `owner`
  // explicitly. In the Atelier + library previews the engagement snapshot
  // always carries author info, so this guarantees the author line shows
  // (clickable → profile) even when the `owner` prop is omitted.
  //
  // `sourceOrigin` is pulled from `item.row.sourceOrigin` so the "Source:
  // <origin>" pill in the owner row always reflects the same value the
  // build-edit form uses — Phase 9 round-3.
  const rowSourceOrigin =
    "row" in item && item.row && typeof item.row === "object" && "sourceOrigin" in item.row
      ? (item.row as { sourceOrigin?: string | null }).sourceOrigin ?? null
      : null;
  // Phase 9 round 5 (post-feedback): the admin mask now also fires
  // when the row's sourceOrigin === "system" — the legacy stock
  // corpus has dirty user_ids (stamped with the current user's
  // clerk id during unrelated edits) so authorIsAdmin doesn't fire
  // for those rows. The sourceOrigin column is the only honest
  // signal that the row belongs to the corpus. Audit trail
  // (authorId) is still set so internal tooling can trace edits.
  const eng = resolvedCallbacks.engagement;
  const isAdminAuthor = eng?.authorIsAdmin === true;
  const isLegacySystemRow = rowSourceOrigin === "system";
  const maskAuthor =
    isAdminAuthor ||
    isLegacySystemRow ||
    !eng?.authorUsername;
  const effectiveAuthorUsername = maskAuthor ? null : eng?.authorUsername;

  const resolvedOwner: EntityPreviewOwner | undefined =
    owner
      ? { ...owner, sourceOrigin: owner.sourceOrigin ?? rowSourceOrigin }
      : effectiveAuthorUsername
      ? {
          authorId: eng?.authorId ?? null,
          authorUsername: effectiveAuthorUsername,
          authorDisplayName: effectiveAuthorUsername,
          authorAvatarUrl: null,
          isOwner:
            !!eng?.authorId &&
            eng.authorId === eng?.currentUserInternalId,
          profileHref: `/u/${effectiveAuthorUsername}`,
          sourceOrigin: rowSourceOrigin,
        }
      : callbacks?.engagement // engagement exists but no author username (or admin author)
      ? {
          authorId: null,
          authorUsername: null,
          authorDisplayName: null,
          authorAvatarUrl: null,
          isOwner: false,
          profileHref: null,
          sourceOrigin: rowSourceOrigin,
        }
      : rowSourceOrigin
      ? {
          authorId: null,
          authorUsername: null,
          authorDisplayName: null,
          authorAvatarUrl: null,
          isOwner: false,
          profileHref: null,
          sourceOrigin: rowSourceOrigin,
        }
      : undefined;

  const footer =
    variant === "build"
      ? onSave || onReset
        ? (
          <div className="mt-2 flex items-center gap-2 border-t border-border px-1 pb-4 pt-4">
            {onSave ? (
              <button
                type="button"
                onClick={onSave}
                disabled={!isDirty}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
              >
                {saveLabel}
              </button>
            ) : null}
            {onReset ? (
              <button
                type="button"
                onClick={onReset}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card/50 px-3 py-1.5 text-sm font-medium text-muted-foreground transition hover:border-primary hover:text-foreground"
              >
                {resetLabel}
              </button>
            ) : null}
          </div>
        )
        : null
      : (
        <>

          <PreviewFooter callbacks={resolvedCallbacks} item={item} />
          {resolvedActionBar ? <PreviewActions {...resolvedActionBar} /> : null}
        </>
      );

  return (
    <div className="v12-entity-preview flex min-h-0 flex-col" data-preview-layout="responsive">
      {actionPlacement === "top" && resolvedActionBar ? <PreviewActions {...resolvedActionBar} /> : null}
      <div className="v12-entity-preview-content min-h-0 pr-1">
        {item.kind !== "primitive" ? <MechanicalSummary row={item.row} /> : null}
        {body}
        {/* OwnerBar MOVED OUT of the body area — it now lives between the
            scrollable content and the footer (just above the like bar)
            so the entity name + creator tag sit immediately above the
            engagement metrics. Phase 9 user-feedback: 'you need to move
            the user in preview to be lower not above the picture, low,
            above the like for bar'. */}
      </div>
      {showOwner && resolvedOwner ? <OwnerBar owner={resolvedOwner} /> : null}
      {actionPlacement === "top"
        ? variant === "build"
          ? footer
          : <PreviewFooter callbacks={resolvedCallbacks} item={item} />
        : footer}
    </div>
  );
}
// ---- owner + action bars (identical across every surface) -----------------

function OwnerBar({ owner }: { owner: NonNullable<EntityPreviewProps["owner"]> }) {
  // Phase 9 user-feedback: when there's no Clerk user attached (system-
  // authored content like the stock "Verb Access Tier I" or "Domain of
  // Storm" primitives) render "by System" instead of returning null —
  // the user wants to see the creator tag even when it's the system, not
  // a hidden gap.
  const hasAuthor =
    !!owner.authorUsername || !!owner.authorDisplayName;
  const display = hasAuthor
    ? owner.authorDisplayName || owner.authorUsername || "unknown"
    : "System";
  // Profile usernames are handles (e.g. "mashu"). If a Clerk-style ID
  // ever slips in, don't render it as the handle — show the display name
  // and only build a profile link from a real-looking username.
  const isId = !!owner.authorUsername && /^user_|usr_/i.test(owner.authorUsername);
  const handle = !hasAuthor ? null : isId ? null : owner.authorUsername;
  const profileHref = handle ? `/u/${handle}` : null;
  // Generated avatar fallback when no uploaded picture exists. For system
  // entries we use a neutral seed so the avatar is consistent across
  // every system-authored row (instead of "unknown" / random initials).
  const fallbackAvatar = hasAuthor
    ? `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(display)}&backgroundType=gradientLinear&radius=50`
    : `https://api.dicebear.com/9.x/initials/svg?seed=SwordWeave%20System&backgroundType=gradientLinear&radius=50`;
  const avatar = owner.authorAvatarUrl || fallbackAvatar;
  const inner = (
    <>
      <img src={avatar} alt="" className="size-5 rounded-full" />
      <span>
        by{" "}
        <span className="font-semibold text-foreground">{display}</span>
        {handle ? <span className="ml-1 text-muted-foreground">@{handle}</span> : null}
      </span>
      {owner.isOwner ? (
        <span className="rounded-full bg-primary/10 px-1.5 py-0.5 font-semibold text-primary">
          you
        </span>
      ) : null}
    </>
  );
  return (
    // Phase 9 round-3: `pt-2` adds a touch of breathing room above the
    // owner row so it doesn't visually hug the body content (user:
    // 'User is good just a bit of more padding top'). When sourceOrigin
    // is set, a small "Source: <origin>" pill renders on the right so
    // the user can see which world/book the entity comes from at a
    // glance — same data as the build-edit "Source origin" field.
    // Phase 9 round-12: user came back — 'In preview it's ok but that
    // horizontal line is still too close to what's above it. Idk
    // exactly what it is.' The border-top is still hugging the body
    // content above it. pt-4 → pt-6 + add a subtle top margin via
    // a containing wrapper class so the gap is unambiguous. The
    // mb on the previous section was implicit; making it pt-6 +
    // mt-3 leaves room between the last content line and the rule.
    <div className="v12-preview-owner-bar mt-3 flex items-center justify-between gap-2 border-t border-border px-1 pb-4 pt-6 text-xs text-muted-foreground">
      {profileHref ? (
        <a href={profileHref} className="flex items-center gap-2 hover:underline">
          {inner}
        </a>
      ) : (
        <div className="flex items-center gap-2">{inner}</div>
      )}
      {owner.sourceOrigin ? (
        <span
          className="truncate rounded-full bg-secondary px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-secondary-foreground"
          title={owner.sourceOrigin}
        >
          Source: {owner.sourceOrigin}
        </span>
      ) : null}
    </div>
  );
}

// ---- footer (read variant) --------------------------------------------------

function PreviewFooter({
  callbacks,
  item,
}: {
  callbacks: PreviewCallbacks;
  item: SandboxPreviewItem;
}) {
  const eng = callbacks.engagement!;
  const { targetType, targetId } = engagementKeys(item);
  return (
    <footer className="mt-2 space-y-4 px-1 pb-6 pt-4">
      <LikeForkBar
        targetType={targetType}
        targetId={targetId}
        initialLikes={eng.likes}
        initialDislikes={eng.dislikes}
        initialForks={eng.forks}
        initialUserReaction={eng.userReaction}
        authorId={eng.authorId}
        authorUsername={eng.authorUsername}
        currentUserId={eng.currentUserInternalId}
        sandboxPath={callbacks.sandboxPath}
        onFork={callbacks.onFork}
      />
      <PreviewFlagSummary targetType={targetType} targetId={targetId} />
    </footer>
  );
}

function engagementKeys(item: SandboxPreviewItem): {
  targetType:
    | "PRIMITIVE"
    | "EFFECT"
    | "CAPABILITY"
    | "ITEM"
    | "LINEAGE_TEMPLATE"
    | "UPBRINGING_TEMPLATE"
    | "MANIFEST_TEMPLATE";
  targetId: string;
} {
  switch (item.kind) {
    case "primitive":
      return { targetType: "PRIMITIVE", targetId: String(item.row.id) };
    case "capability":
      return { targetType: "CAPABILITY", targetId: item.row.id };
    case "heritage":
      return {
        targetType:
          item.row.kind === "LINEAGE"
            ? "LINEAGE_TEMPLATE"
            : item.row.kind === "UPBRINGING"
              ? "UPBRINGING_TEMPLATE"
              : "MANIFEST_TEMPLATE",
        targetId: item.row.id,
      };
    case "item":
      return { targetType: "ITEM", targetId: item.row.id };
    case "effect":
      return { targetType: "EFFECT", targetId: item.row.id };
  }
}

// ---- per-kind bodies --------------------------------------------------------

function PrimitiveBody({
  row,
  onSubLink,
  buildModifiers,
  showIdentity,
}: {
  row: SandboxPrimitiveRow;
  onSubLink: (link: PreviewSubLink) => void;
  buildModifiers?: Array<Record<string, unknown>> | undefined;
  showIdentity: boolean;
}) {
  return (
    <div className="v12-primitive-preview-body space-y-4">
      <div className="v12-primitive-preview-primary">
        {showIdentity ? <Header
          fallback="PRI"
          iconSource={row.iconSource}
          iconKey={row.iconKey}
          iconUrl={row.iconUrl}
          iconColor={row.iconColor}
          label={`Primitive · ${row.category}`}
          chips={
            <>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono font-semibold text-primary">{row.buCost} BU</span>
              <span className="rounded-full bg-secondary px-2 py-0.5 font-medium">{row.costTier}</span>
              <VisibilityPill isPublic={row.isPublic} />
            </>
          }
        /> : null}
        {row.tags.length > 0 ? (
          <Section heading="Tags">
            <div className="flex flex-wrap gap-1.5">
              {row.tags.map((tag) => (
                <span key={tag} className="rounded-full border border-border bg-secondary/60 px-2.5 py-0.5 text-xs font-medium">{tag}</span>
              ))}
            </div>
          </Section>
        ) : null}
        {row.narrativeRule ? <Section heading={row.mechanicalOutputText ? "Narrative rule" : "Description"}><Markdown>{row.narrativeRule}</Markdown></Section> : null}
      </div>
      <div className="v12-primitive-preview-secondary">
        {row.mechanicalOutputText ? (
          <Section heading="Mechanical output">
            <div className="v12-mechanical-rule"><Markdown copyRole="mechanical">{row.mechanicalOutputText}</Markdown></div>
          </Section>
        ) : null}
        <ModifierCards row={row} buildModifiers={buildModifiers} />
      </div>
      {/* Phase 8.I i2.5h-fix2 (Mashu 2026-08-06): removed the
          Mirror BU credit card. The user wanted the modifier
          card to be the single mirror surface. BU credit info
          still visible elsewhere (e.g. primitive header). */}
    </div>
  );
}

function EffectBody({
  row,
  onSubLink,
}: {
  row: SandboxEffectRow;
  onSubLink: (link: PreviewSubLink) => void;
}) {
  // Phase 8.1 batch 13.1 follow-up: effect previews have no nested
  // capabilities or effects — their primitives ARE the leaf set —
  // so the direct sum is correct here. (Keeping the existing
  // behavior rather than calling computeTransitiveBu since the
  // helper would be a no-op for an effect row.)
  const totalBu = row.primitiveLinks.reduce((s, l) => s + Math.abs(l.primitive.buCost * l.quantity), 0);
  return (
    <div className="v12-composite-preview-body space-y-5">
      <div className="v12-composite-preview-primary">
        <Header
        fallback="EFF"
        iconSource={row.iconSource}
        iconKey={row.iconKey}
        iconUrl={row.iconUrl}
        iconColor={row.iconColor}
        label="Effect"
        chips={
          <>
            <span className="rounded-full bg-primary/15 px-2.5 py-0.5 font-mono font-semibold text-primary">{totalBu} BU</span>
            {row.sourceOrigin ? <span className="rounded-full bg-secondary px-2 py-0.5 font-medium uppercase tracking-wide text-secondary-foreground">{row.sourceOrigin}</span> : null}
            <VisibilityPill isPublic={row.isPublic} />
          </>
        }
        />
        {row.narrativeDescription ? (
          <Section heading="Narrative description"><Markdown>{row.narrativeDescription}</Markdown></Section>
        ) : null}
        {row.tags.length > 0 ? (
          <Section heading="Tags"><div className="flex flex-wrap gap-1.5">{row.tags.map((tag) => <span key={tag} className="rounded-full border border-border bg-secondary/60 px-2.5 py-0.5 text-xs font-medium">{tag}</span>)}</div></Section>
        ) : null}
      </div>
      <div className="v12-composite-preview-secondary"><ComposedList
        title={`Composed primitives (${row.primitiveLinks.length})`}
        onSubLink={onSubLink}
        items={row.primitiveLinks.map((l) => ({
          id: String(l.primitive.id),
          name: l.primitive.name,
          bu: Math.abs(l.primitive.buCost * l.quantity),
          versionNumber: l.versionNumber,
          entityKind: "primitive" as const,
          note: primitiveCardCopy(l.primitive),
          noteRole: primitiveCopyRole(l.primitive),
        }))}
      /></div>
    </div>
  );
}

function CapabilityBody({
  row,
  onSubLink,
}: {
  row: SandboxCapabilityRow;
  onSubLink: (link: PreviewSubLink) => void;
}) {
  // Phase 8.1 batch 13.1 follow-up: a capability's BU cost is the
  // sum of ALL primitives it brings in — direct + primitives
  // inherited from each effect. Per Mashu 2026-07-22: "only
  // primitives cost BU. Capabilities, effects, heritages, and items
  // are ways to organize primitives for runtime use — they NEVER
  // debit BU on their own." So the chip on the capability card must
  // show the full transitive closure.
  const totalBu = Math.abs(
    computeTransitiveBu({
      primitiveLinks: row.primitiveLinks.map((l) => ({
        primitiveId: l.primitive.id,
        quantity: l.quantity,
        primitive: { id: l.primitive.id, buCost: l.primitive.buCost },
      })),
      effectLinks: row.effectLinks.map((e) => ({
        effectId: e.effectId,
        primitiveLinks: (e.effect.primitiveLinks ?? []).map((pl) => ({
          primitiveId: pl.primitive.id,
          quantity: 1,
          primitive: { id: pl.primitive.id, buCost: pl.primitive.buCost },
        })),
      })),
    }).transitiveBu,
  );
  const effectNodes: CompositionNode[] = row.effectLinks.map((link) => ({
    id: link.effectId,
    name: link.effect.name,
    kind: "effect",
    targetType: "EFFECT",
    bu: (link.effect.primitiveLinks ?? []).reduce((sum, primitiveLink) => sum + Math.abs(primitiveLink.primitive.buCost * primitiveLink.quantity), 0),
    versionNumber: link.versionNumber,
    note: link.effect.narrativeDescription ?? null,
    meta: <>{(link.effect.primitiveLinks ?? []).length} primitives{link.slotLabel ? <> · &ldquo;{link.slotLabel}&rdquo;</> : null}</>,
    children: (link.effect.primitiveLinks ?? []).map((primitiveLink) => ({
      id: String(primitiveLink.primitive.id),
      name: primitiveLink.primitive.name,
      kind: "primitive",
      targetType: "PRIMITIVE",
      bu: Math.abs(primitiveLink.primitive.buCost * primitiveLink.quantity),
      note: primitiveCardCopy(primitiveLink.primitive),
          noteRole: primitiveCopyRole(primitiveLink.primitive),
    })),
  }));
  return (
    <div className="v12-composite-preview-body space-y-4">
      <div className="v12-composite-preview-primary">
        <Header
          fallback="CAP"
          iconSource={row.iconSource}
          iconKey={row.iconKey}
          iconUrl={row.iconUrl}
          iconColor={row.iconColor}
          label={`Capability · ${row.type} · ${row.sourceType}`}
          chips={
            <>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono font-semibold text-primary">{totalBu} BU</span>
              <span className="rounded-full bg-secondary px-2 py-0.5 font-medium">{row.sourceOrigin ?? "—"}</span>
              <VisibilityPill isPublic={row.isPublic} />
            </>
          }
        />
        {row.verboseDescription ? (
          <Section heading="Description">
            <Markdown>{row.verboseDescription}</Markdown>
          </Section>
        ) : null}
        {row.tags.length > 0 ? (
          <Section heading="Tags">
            <div className="flex flex-wrap gap-1">
              {row.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-secondary px-2 py-0.5 text-xs">{tag}</span>
              ))}
            </div>
          </Section>
        ) : null}
      </div>
      <div className="v12-composite-preview-secondary">
        <ComposedList
        title={`Composed primitives (${row.primitiveLinks.length})`}
        onSubLink={onSubLink}
        items={row.primitiveLinks.map((l) => ({
          id: String(l.primitive.id),
          name: l.primitive.name,
          bu: Math.abs(l.primitive.buCost * l.quantity),
          versionNumber: l.versionNumber,
          entityKind: "primitive" as const,
          note: primitiveCardCopy(l.primitive),
          noteRole: primitiveCopyRole(l.primitive),
        }))}
        />
        <CompositionTree title="Composed effects" nodes={effectNodes} onSubLink={onSubLink} />
      </div>
    </div>
  );
}

function TemplateBody({
  row,
  onSubLink,
}: {
  row: SandboxTemplateRow;
  onSubLink: (link: PreviewSubLink) => void;
}) {
  // Phase 8.1 batch 13.1 follow-up: a heritage's BU cost is the
  // full transitive closure — direct primitives + primitives from
  // each bundled capability + primitives from each capability's
  // effects. The previous code only summed direct primitives.
  const transitiveResult = computeTransitiveBu({
    primitiveLinks: row.primitiveLinks.map((l) => ({
      primitiveId: l.primitive.id,
      quantity: 1,
      primitive: { id: l.primitive.id, buCost: l.primitive.buCost },
    })),
    capabilityLinks: row.capabilityLinks.map((cl) => ({
      capabilityId: cl.capability.id,
      primitiveLinks: (cl.capability.primitiveLinks ?? []).map((pl) => ({
        primitiveId: pl.primitive.id,
        quantity: 1,
        primitive: { id: pl.primitive.id, buCost: pl.primitive.buCost },
      })),
      effectLinks: (cl.capability.effectLinks ?? []).map((effectLink) => ({
        effectId: effectLink.effectId,
        primitiveLinks: (effectLink.primitiveLinks ?? []).map((pl) => ({
          primitiveId: pl.primitive.id,
          quantity: 1,
          primitive: { id: pl.primitive.id, buCost: pl.primitive.buCost },
        })),
      })),
    })),
  });
  const primitiveBu = Math.abs(transitiveResult.transitiveBu);
  const capabilityNodes: CompositionNode[] = row.capabilityLinks.map((link) => {
    const capabilityEffects = link.capability.effectLinks ?? [];
    const directPrimitives = link.capability.primitiveLinks ?? [];
    return {
      id: link.capability.id,
      name: link.capability.name,
      kind: "capability",
      targetType: "CAPABILITY",
      bu: Math.abs(computeTransitiveBu({ primitiveLinks: directPrimitives, effectLinks: capabilityEffects }).transitiveBu),
      versionNumber: link.versionNumber,
      meta: <>{link.capability.type} · {capabilityEffects.length} effects · {directPrimitives.length} direct primitives</>,
      children: [
        ...directPrimitives.map((primitiveLink): CompositionNode => ({
          id: String(primitiveLink.primitive.id),
          name: primitiveLink.primitive.name,
          kind: "primitive",
          targetType: "PRIMITIVE",
          bu: Math.abs(primitiveLink.primitive.buCost),
          note: primitiveCardCopy(primitiveLink.primitive),
          noteRole: primitiveCopyRole(primitiveLink.primitive),
        })),
        ...capabilityEffects.map((effectLink): CompositionNode => {
          // Heritage endpoints carry these primitives on the capability→effect
          // link. Capability endpoints carry them inside `effect`. Accept both
          // shapes so an effect never appears as a non-expandable empty row.
          const nestedEffect = effectLink.effect as typeof effectLink.effect & {
            primitiveLinks?: typeof effectLink.primitiveLinks;
          };
          const effectPrimitives = effectLink.primitiveLinks?.length
            ? effectLink.primitiveLinks
            : nestedEffect.primitiveLinks ?? [];
          return ({
          id: effectLink.effectId,
          name: effectLink.effect.name,
          kind: "effect",
          targetType: "EFFECT",
          bu: Math.abs(effectPrimitives.reduce((sum, primitiveLink) => sum + primitiveLink.primitive.buCost, 0)),
          meta: <>{effectPrimitives.length} primitives</>,
          children: effectPrimitives.map((primitiveLink): CompositionNode => ({
            id: String(primitiveLink.primitive.id),
            name: primitiveLink.primitive.name,
            kind: "primitive",
            targetType: "PRIMITIVE",
            bu: Math.abs(primitiveLink.primitive.buCost),
            note: primitiveCardCopy(primitiveLink.primitive),
          noteRole: primitiveCopyRole(primitiveLink.primitive),
          })),
        });}),
      ],
    };
  });
  return (
    <div className="v12-composite-preview-body space-y-4">
      <div className="v12-composite-preview-primary">
        <Header
        fallback="TPL"
        iconSource={row.iconSource}
        iconKey={row.iconKey}
        iconUrl={row.iconUrl}
        iconColor={row.iconColor}
        label={row.kind}
        chips={
          <>
            <span
              className="rounded-full bg-primary/10 px-2 py-0.5 font-mono font-semibold text-primary"
              title={`Transitive total: ${transitiveResult.transitiveCount} primitives (${row.primitiveLinks.length} direct + ${transitiveResult.transitiveCount - row.primitiveLinks.length} via capabilities)`}
            >
              {primitiveBu} BU
            </span>
            <VisibilityPill isPublic={row.isPublic} />
          </>
        }
        />
        {lineageArtUrl(row) ? <img src={lineageArtUrl(row)!} alt={row.name} className="mb-4 w-full max-w-md rounded-md border border-border" /> : null}
        {row.description ? (
          <Section heading="Description"><Markdown>{row.description}</Markdown></Section>
        ) : null}
        {row.suggestedTraits ? (
          <Section heading="Suggested traits"><Markdown>{row.suggestedTraits}</Markdown></Section>
        ) : null}
      </div>
      <div className="v12-composite-preview-secondary">
      <CompositionTree title="Bundled capabilities" nodes={capabilityNodes} onSubLink={onSubLink} />
      <ComposedList
        title={`Direct primitives (${row.primitiveLinks.length})`}
        onSubLink={onSubLink}
        items={row.primitiveLinks.map((l) => ({
          id: String(l.primitive.id),
          name: l.primitive.name,
          bu: l.primitive.buCost,
          versionNumber: l.versionNumber,
          entityKind: "primitive" as const,
          note: primitiveCardCopy(l.primitive),
          noteRole: primitiveCopyRole(l.primitive),
        }))}
      />
      </div>
    </div>
  );
}

function ItemBody({
  row,
  onSubLink,
}: {
  row: SandboxItemRow;
  onSubLink: (link: PreviewSubLink) => void;
}) {
  const transitive = computeTransitiveBu({
    primitiveLinks: row.primitiveLinks.map((link) => ({
      primitiveId: link.primitive.id,
      quantity: 1,
      primitive: { id: link.primitive.id, buCost: link.primitive.buCost },
    })),
    effectLinks: row.effectLinks.map((effectLink) => ({
      effectId: effectLink.effectId,
      primitiveLinks: (effectLink.effect.primitiveLinks ?? []).map((link) => ({
        primitiveId: link.primitive.id,
        quantity: link.quantity,
        primitive: { id: link.primitive.id, buCost: link.primitive.buCost },
      })),
    })),
    capabilityLinks: row.capabilityLinks.map((capabilityLink) => ({
      capabilityId: capabilityLink.capabilityId,
      primitiveLinks: capabilityLink.capability.primitiveLinks ?? [],
      effectLinks: capabilityLink.capability.effectLinks ?? [],
    })),
  });
  const totalBu = row.buCost + Math.abs(transitive.transitiveBu);
  const capabilityNodes: CompositionNode[] = row.capabilityLinks.map((link) => {
    const effects = link.capability.effectLinks ?? [];
    const directPrimitives = link.capability.primitiveLinks ?? [];
    return {
      id: link.capabilityId,
      name: link.capability.name,
      kind: "capability",
      targetType: "CAPABILITY",
      bu: Math.abs(computeTransitiveBu({ primitiveLinks: directPrimitives, effectLinks: effects }).transitiveBu),
      versionNumber: link.versionNumber,
      meta: <>{link.capability.type} · {effects.length} effects · {directPrimitives.length} direct primitives</>,
      children: [
        ...directPrimitives.map((primitiveLink): CompositionNode => ({
          id: String(primitiveLink.primitive.id),
          name: primitiveLink.primitive.name,
          kind: "primitive",
          targetType: "PRIMITIVE",
          bu: Math.abs(primitiveLink.primitive.buCost),
          note: primitiveCardCopy(primitiveLink.primitive),
          noteRole: primitiveCopyRole(primitiveLink.primitive),
        })),
        ...effects.map((effectLink): CompositionNode => ({
          id: effectLink.effectId,
          name: effectLink.effect.name,
          kind: "effect",
          targetType: "EFFECT",
          bu: Math.abs((effectLink.primitiveLinks ?? []).reduce((sum, primitiveLink) => sum + primitiveLink.primitive.buCost, 0)),
          meta: <>{(effectLink.primitiveLinks ?? []).length} primitives</>,
          children: (effectLink.primitiveLinks ?? []).map((primitiveLink): CompositionNode => ({
            id: String(primitiveLink.primitive.id),
            name: primitiveLink.primitive.name,
            kind: "primitive",
            targetType: "PRIMITIVE",
            bu: Math.abs(primitiveLink.primitive.buCost),
            note: primitiveCardCopy(primitiveLink.primitive),
          noteRole: primitiveCopyRole(primitiveLink.primitive),
          })),
        })),
      ],
    };
  });
  const effectNodes: CompositionNode[] = row.effectLinks.map((link) => ({
    id: link.effectId,
    name: link.effect.name,
    kind: "effect",
    targetType: "EFFECT",
    bu: (link.effect.primitiveLinks ?? []).reduce((sum, primitiveLink) => sum + Math.abs(primitiveLink.primitive.buCost * primitiveLink.quantity), 0),
    versionNumber: link.versionNumber,
    note: link.effect.narrativeDescription ?? null,
    meta: <>{(link.effect.primitiveLinks ?? []).length} primitives{link.slotLabel ? <> · &ldquo;{link.slotLabel}&rdquo;</> : null}</>,
    children: (link.effect.primitiveLinks ?? []).map((primitiveLink) => ({
      id: String(primitiveLink.primitive.id),
      name: primitiveLink.primitive.name,
      kind: "primitive",
      targetType: "PRIMITIVE",
      bu: Math.abs(primitiveLink.primitive.buCost * primitiveLink.quantity),
      note: primitiveCardCopy(primitiveLink.primitive),
          noteRole: primitiveCopyRole(primitiveLink.primitive),
    })),
  }));
  return (
    <div className="v12-composite-preview-body space-y-4">
      <div className="v12-composite-preview-primary">
        <Header
        fallback="ITM"
        iconSource={row.iconSource}
        iconKey={row.iconKey}
        iconUrl={row.iconUrl}
        iconColor={row.iconColor}
        label={row.itemType}
        chips={
          <>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono font-semibold text-primary">{totalBu} BU</span>
            <span className={`rounded-full px-2 py-0.5 font-medium ${rarityClass(row.rarity)}`}>{row.rarity}</span>
            {/* Phase 8.5 H4-rev: rename to "Equipped slots • N". */}
            <span className="rounded-full bg-secondary px-2 py-0.5 font-medium">
              Equipped slots • {row.slotCost}
            </span>
            {/* Phase 8.5 / Session H1: size drives encumbrance Load. */}
            {row.size ? (
              <span
                className="rounded-full bg-secondary px-2 py-0.5 font-medium"
                title={
                  row.size === "TINY"
                    ? "Tiny items use the pouch system: 1000 tiny items = 1 Load."
                    : `Encumbrance: ${SIZE_LOAD[row.size as keyof typeof SIZE_LOAD] ?? 0} Load per item`
                }
              >
                Size {row.size}
                {row.size === "TINY"
                  ? " (pouch · 1000 = 1 Load)"
                  : ` • ${SIZE_LOAD[row.size as keyof typeof SIZE_LOAD] ?? 0} Load`}
              </span>
            ) : null}
            {row.quantity && row.quantity > 1 ? (
              <span
                className="rounded-full bg-secondary px-2 py-0.5 font-medium"
                title={`Quantity multiplies Load/Capacity per item (×${row.quantity})`}
              >
                Quantity ×{row.quantity}
              </span>
            ) : null}
            {row.isTwoHanded ? <span className="rounded-full bg-secondary px-2 py-0.5 font-medium">Two-handed</span> : null}
            {row.isConsumable ? <span className="rounded-full bg-secondary px-2 py-0.5 font-medium">Consumable</span> : null}
            {row.actsAsFocus ? <span className="rounded-full bg-secondary px-2 py-0.5 font-medium">Focus</span> : null}
            {row.sourceOrigin ? <span className="rounded-full bg-secondary px-2 py-0.5 font-medium">{row.sourceOrigin}</span> : null}
            <VisibilityPill isPublic={row.isPublic} />
          </>
        }
        />
        {row.description ? <Section heading="Description"><Markdown>{row.description}</Markdown></Section> : null}
        {row.tags.length > 0 ? (
          <Section heading="Tags"><div className="flex flex-wrap gap-1">{row.tags.map((tag) => <span key={tag} className="rounded-full bg-secondary px-2 py-0.5 text-xs">{tag}</span>)}</div></Section>
        ) : null}
      </div>
      <div className="v12-composite-preview-secondary">
      <CompositionTree title="Bundled capabilities" nodes={capabilityNodes} onSubLink={onSubLink} />
      <CompositionTree title="Bundled effects" nodes={effectNodes} onSubLink={onSubLink} />
      <ComposedList
        title={`Direct primitives (${row.primitiveLinks.length})`}
        onSubLink={onSubLink}
        items={row.primitiveLinks.map((l) => ({
          id: String(l.primitive.id),
          name: l.primitive.name,
          bu: l.primitive.buCost,
          versionNumber: l.versionNumber,
          entityKind: "primitive" as const,
          note: primitiveCardCopy(l.primitive),
          noteRole: primitiveCopyRole(l.primitive),
        }))}
      />
      </div>
    </div>
  );
}

// ---- shared header ----------------------------------------------------------

function Header({
  fallback,
  iconSource,
  iconKey,
  iconUrl,
  iconColor,
  label,
  chips,
}: {
  fallback: string;
  iconSource: string | null;
  iconKey: string | null;
  iconUrl: string | null;
  iconColor: string;
  label: string;
  chips: ReactNode;
}) {
  return (
    <div className="v12-preview-identity flex items-center gap-2">
      <div className="v12-preview-medallion"><IconTile
        row={{ iconSource, iconKey, iconUrl, iconColor, fallback }}
      /></div>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-xs">
        <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {label}
        </span>
        <span className="flex min-w-0 max-w-full flex-wrap items-center gap-2 [&>*]:max-w-full [&>*]:truncate">{chips}</span>
      </div>
    </div>
  );
}

function rarityClass(rarity: string): string {
  switch (rarity) {
    case "COMMON":
      return "bg-slate-500/15 text-slate-700 dark:text-slate-300";
    case "UNCOMMON":
      return "bg-green-500/15 text-green-700 dark:text-green-400";
    case "RARE":
      return "bg-blue-500/15 text-blue-700 dark:text-blue-400";
    case "EPIC":
      return "bg-purple-500/15 text-purple-700 dark:text-purple-400";
    case "LEGENDARY":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-400";
    default:
      return "bg-secondary";
  }
}

/** Loads the same complete record used by the author and source page. */
export function FetchedEntityPreview({ targetType, targetId, owner }: { targetType: string; targetId: string; owner?: EntityPreviewOwner }) {
  const [result, setResult] = useState<{ key: string; item?: SandboxPreviewItem; error?: string } | null>(null);
  const [engagement, setEngagement] = useState<NonNullable<PreviewCallbacks["engagement"]>>({
    likes: 0,
    dislikes: 0,
    forks: 0,
    userReaction: null,
    authorId: owner?.authorId ?? null,
    authorUsername: owner?.authorUsername ?? null,
    authorIsAdmin: null,
    currentUserInternalId: null,
  });
  const key = `${targetType}:${targetId}`;
  useEffect(() => {
    const controller = new AbortController();
    const kind = targetType.endsWith("_TEMPLATE") || targetType.startsWith("TEMPLATE_") || ["LINEAGE", "UPBRINGING", "MANIFEST"].includes(targetType) ? "heritage" : targetType.toLowerCase();
    const endpoint = ({ primitive: "primitives", effect: "effects", capability: "capabilities", heritage: "heritage", item: "items" } as Record<string, string>)[kind];
    if (!endpoint) return;
    Promise.all([
      fetch(`/api/${endpoint}/${encodeURIComponent(targetId)}`, { signal: controller.signal })
        .then(async response => { if (!response.ok) throw new Error("Unable to load this record."); return response.json(); }),
      fetch(`/api/engagement/lookup?targetType=${encodeURIComponent(targetType)}&targetId=${encodeURIComponent(targetId)}`, { signal: controller.signal })
        .then(async response => response.ok ? response.json() : null),
    ])
      .then(([data, engagementData]) => {
        const row = data[kind === "heritage" ? "template" : kind];
        if (!row) throw new Error("The record is unavailable.");
        setResult({ key, item: { kind, row } as SandboxPreviewItem });
        setEngagement({
          likes: Number(engagementData?.likes ?? 0),
          dislikes: Number(engagementData?.dislikes ?? 0),
          forks: Number(engagementData?.forks ?? 0),
          userReaction: engagementData?.userReaction ?? null,
          authorId: owner?.authorId ?? null,
          authorUsername: owner?.authorUsername ?? null,
          authorIsAdmin: null,
          currentUserInternalId: engagementData?.currentUserInternalId ?? null,
        });
      }).catch(error => { if (!controller.signal.aborted) setResult({ key, error: String(error.message) }); });
    return () => controller.abort();
  }, [key, owner?.authorId, owner?.authorUsername, targetId, targetType]);
  return <div className="v12-fetched-preview">
    {result?.key === key ? result.item ? (
      <EntityPreview
        item={result.item}
        {...(owner ? { owner } : {})}
        callbacks={{
          engagement,
          openSourceHref: `/library/item/${key}`,
          versionHistoryHref: `/library/item/${key}/versions`,
        }}
        actionBar={{
          openSourceHref: `/library/item/${key}`,
          forkMap: (
            <ForkMapButton
              targetType={targetType as ForkTargetType}
              targetId={targetId}
              targetName={result.item.row.name}
              className="min-w-0 flex-1 justify-center px-1.5 py-2 text-xs"
            />
          ),
          versionHistoryHref: `/library/item/${key}/versions`,
        }}
      />
    ) : <p role="alert">{result.error}</p> : <p role="status">Loading the complete record…</p>}
  </div>;
}
