// Read-only primitive card used in the SandboxLayout Preview column.
// Mirrors the structure of /library/item/PRIMITIVE:<id> detail page but
// stripped of engagement and authorship metadata.

import { Markdown } from "@/components/ui/markdown";
import { IconDisplay } from "@/components/icons/icon-display";
import { EntityPreview } from "@/components/preview/entity-preview";
import type {
  SandboxPreviewItem,
} from "@/components/library/library-item-preview";
import type { HardModifier } from "@/types/swordweave";
import {
  OP_SPECS,
  type ModifierOperation,
} from "@/types/modifier";

type PrimitiveRow = {
  id: number;
  name: string;
  category: string;
  costTier: string;
  buCost: number;
  isPublic: boolean;
  isMirrorable: boolean;
  mirrorVector: string | null;
  mirrorBuCredit: number | null;
  mirrorEligibilityNotes: string | null;
  mechanicalOutputText: string;
  narrativeRule: string;
  // Phase 8: per-entity iconography
  iconSource: string | null;
  iconKey: string | null;
  iconUrl: string | null;
  iconColor: string;
  /**
   * Phase 7.5 v4: optional modifier list. When present,
   * each modifier is rendered with its op, target, and
   * mirrorability. The pre-existing primitives built before
   * this field was added carry undefined — those rows
   * just skip the modifier block.
   */
  modifiers?: readonly HardModifier[];
};

function categoryLabel(category: string): string {
  return category
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Phase 7.5 v4: human-readable mirror description for a
 * modifier op. "Add" mirrors to "Subtract" (sign flip),
 * "Multiply" mirrors to "Divide" (value inversion), "Set To"
 * is permission-locked (not mirrorable), etc.
 *
 * This is what the user sees in the source/build preview so
 * they know what the modifier does when invoked in a
 * mirrored context.
 */
export function mirrorDescription(op: ModifierOperation): {
  readonly mirrorable: boolean;
  readonly summary: string;
} {
  const spec = OP_SPECS[op];
  if (!spec.mirrorable || !spec.mirrorOp) {
    return {
      mirrorable: false,
      summary: `Permission-locked — ${op} does not mirror. The effect is one-directional regardless of polarity.`,
    };
  }
  const target = spec.mirrorOp;
  if (spec.mirrorFlipsSign) {
    return {
      mirrorable: true,
      summary: `Mirrors to ${target} (sign flip) — the value is negated in mirrored contexts.`,
    };
  }
  if (spec.mirrorInvertsValue) {
    return {
      mirrorable: true,
      summary: `Mirrors to ${target} (value inversion) — the value becomes its reciprocal in mirrored contexts.`,
    };
  }
  return {
    mirrorable: true,
    summary: `Mirrors to ${target} — the operator flips; the value stays the same.`,
  };
}

export function PrimitivePreview({ row }: { row: PrimitiveRow }) {
  // Unify with every other surface: render through the single
  // EntityPreview so the detail page + character sheets match the
  // library / creations / atelier modals exactly (same header, same
  // modifier cards, same mirror panel — and NO raw `mirrorVector` string).
  const item: SandboxPreviewItem = {
    kind: "primitive",
    row: {
      id: row.id,
      name: row.name,
      category: row.category,
      buCost: row.buCost,
      isPublic: row.isPublic,
      costTier: row.costTier,
      mechanicalOutputText: row.mechanicalOutputText,
      narrativeRule: row.narrativeRule,
      isMirrorable: row.isMirrorable,
      mirrorVector: row.mirrorVector ?? "STANDARD_ONLY",
      mirrorBuCredit: row.mirrorBuCredit ?? 0,
      mirrorEligibilityNotes: row.mirrorEligibilityNotes ?? "",
      sourceOrigin: null,
      tags: [],
      hardModifiers: row.modifiers ?? [],
      iconSource: row.iconSource,
      iconKey: row.iconKey,
      iconUrl: row.iconUrl,
      iconColor: row.iconColor,
    },
  };
  return <EntityPreview item={item} variant="read" />;
}

export function PrimitivePreviewEmpty() {
  return (
    <div className="flex h-full items-center justify-center p-6 text-center">
      <div className="max-w-xs space-y-2">
        <p className="text-sm font-medium text-muted-foreground">
          No primitive selected
        </p>
        <p className="text-xs text-muted-foreground">
          Pick a primitive from the Library to preview it here, or create a
          new one in the Build tab.
        </p>
      </div>
    </div>
  );
}