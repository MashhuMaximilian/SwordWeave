/**
 * Condition Dictionary — Phase 8.I POST C1
 *
 * Maps engine condition tokens to human-readable text. Single source of
 * truth for character sheet modals, /atelier preview modals, and any
 * other UI that surfaces conditions.
 *
 * The token taxonomy is defined by `src/types/condition.ts`. This module
 * implements a fallback chain so unknown tokens render raw rather than
 * throwing.
 */

import type { ModifierCondition } from "@/types/condition";

/**
 * Human-readable single-token. AND/OR pass through unchanged so callers
 * can join compound tokens with the operator.
 */
export function humanReadableToken(token: string): string {
  if (token === "AND") return "AND";
  if (token === "OR") return "OR";

  // self:proficient_in(X)
  const mProf = token.match(/^self:proficient_in\((\w+)\)$/);
  if (mProf) return `Proficient in ${mProf[1]}`;

  // self:proficient_in_attribute(X) and self:not_proficient_in_attribute(X)
  const mProfAttr = token.match(/^self:proficient_in_attribute\((\w+)\)$/);
  if (mProfAttr) return `Proficient in attribute ${mProfAttr[1]}`;
  const mNotProfAttr = token.match(
    /^self:not_proficient_in_attribute\((\w+)\)$/,
  );
  if (mNotProfAttr) return `Not proficient in attribute ${mNotProfAttr[1]}`;

  // self:stat|vitality_pct|<|0.5  (and >, <=, >=)
  const mVital = token.match(
    /^self:stat\|vitality_pct\|(>=|<=|>|<|=)\|(\d+(?:\.\d+)?)$/,
  );
  if (mVital && mVital[1] && mVital[2]) {
    const op = mVital[1];
    const pct = Math.round(parseFloat(mVital[2]) * 100);
    const opLabel =
      op === "<"
        ? "below"
        : op === ">"
          ? "above"
          : op === "<="
            ? "at or below"
            : op === ">="
              ? "at or above"
              : "equal to";
    return `HP ${opLabel} ${pct}%`;
  }

  // self:stat|name|<op>|value (generic stat)
  const mStat = token.match(/^self:stat\|(\w+)\|(>=|<=|>|<|=)\|(\S+)$/);
  if (mStat) {
    const stat = mStat[1];
    const op = mStat[2];
    const val = mStat[3];
    return `${stat} ${op} ${val}`;
  }

  // self:is_tracking
  if (token === "self:is_tracking") return "Tracking an active mark";

  // self:not_proficient
  if (token === "self:not_proficient") return "Not proficient";
  // self:not_proficient_in(X)
  const mNotProf = token.match(/^self:not_proficient_in\((\w+)\)$/);
  if (mNotProf) return `Not proficient in ${mNotProf[1]}`;

  // self:proficient_in(all_practices) / self:not_proficient_in(all_practices)
  if (token === "self:proficient_in(all_practices)")
    return "Proficient in every practice";
  if (token === "self:not_proficient_in(all_practices)")
    return "Not proficient in every practice";

  // self:proficient_in(all_saves) / self:not_proficient_in(all_saves)
  if (token === "self:proficient_in(all_saves)")
    return "Proficient in every save";
  if (token === "self:not_proficient_in(all_saves)")
    return "Not proficient in every save";

  // actor:* legacy preset aliases (act on character)
  if (token === "actor:damaged-last-round") return "Damaged last round";
  if (token === "actor:prone") return "Prone";
  if (token === "actor:stance") return "Has a stance";
  if (token === "actor-below-half-hp") return "HP below 50%";
  if (token === "actor-stance") return "Has a stance";

  // target:* axis tags
  if (token.startsWith("target:")) {
    return `Target is ${humanizeTag(token.slice("target:".length))}`;
  }

  // scene:* axis tags
  if (token.startsWith("scene:")) {
    return `Scene is ${humanizeTag(token.slice("scene:".length))}`;
  }

  // Fallback: return raw token (better than throwing)
  return token;
}

/**
 * Human-readable full condition (compound or otherwise).
 * Renders AND/OR chains naturally.
 */
export function humanReadableCondition(condition: ModifierCondition | null | undefined): string {
  if (!condition) return "Always active";
  if (condition.kind === "narrative") return condition.text;
  if (condition.kind === "preset") {
    return humanReadableToken(`actor:${condition.presetKey}`);
  }
  if (condition.kind === "tags") {
    return condition.customTags.map(humanReadableToken).join(" AND ");
  }
  if (condition.kind === "compound") {
    return condition.tokens.map(humanReadableToken).join(" ");
  }
  return "Unknown condition";
}

function humanizeTag(tag: string): string {
  return tag
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/-/g, " ");
}
