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

import { CONDITION_PRESETS, type ModifierCondition } from "@/types/condition";

export function hasMeaningfulCondition(condition: unknown): condition is ModifierCondition {
  if (!condition || typeof condition !== "object") return false;
  const value = condition as {
    kind?: unknown;
    text?: unknown;
    customTags?: unknown;
    tokens?: unknown;
    presetKey?: unknown;
  };
  if (value.kind === "narrative") return typeof value.text === "string" && value.text.trim().length > 0;
  if (value.kind === "tags") return Array.isArray(value.customTags) && value.customTags.some((tag) => typeof tag === "string" && tag.trim().length > 0);
  if (value.kind === "compound") return Array.isArray(value.tokens) && value.tokens.some((token) => typeof token === "string" && token.trim() !== "" && token !== "AND" && token !== "OR");
  if (value.kind === "preset") return typeof value.presetKey === "string" && value.presetKey.trim().length > 0;
  return false;
}

/**
 * Human-readable single-token. AND/OR pass through unchanged so callers
 * can join compound tokens with the operator.
 */
export function humanReadableToken(token: string): string {
  const trimmed = token.trim();
  if (!trimmed) return "";
  token = trimmed;
  if (token === "AND") return "AND";
  if (token === "OR") return "OR";

  const preset = CONDITION_PRESETS.find((entry) => entry.key === token);
  if (preset) {
    return preset.label
      .replace("Actor < 50% HP", "Actor is below 50% vitality")
      .replace("Target < 50% HP", "Target is below 50% vitality");
  }

  const subjectMatch = token.match(/^(self|actor):(.+)$/i);
  const subject = subjectMatch?.[1]?.toLowerCase() === "actor" ? "Actor" : "Character";
  const expression = subjectMatch?.[2] ?? token;

  if (expression === "proficient_in(all_practices)") return `${subject} is proficient in every practice`;
  if (expression === "not_proficient_in(all_practices)") return `${subject} is not proficient in every practice`;
  if (expression === "proficient_in(all_saves)") return `${subject} is proficient in every save`;
  if (expression === "not_proficient_in(all_saves)") return `${subject} is not proficient in every save`;

  const mProf = expression.match(/^proficient_in\(([^)]+)\)$/i);
  if (mProf?.[1]) return `${subject} is proficient in ${humanizeName(mProf[1])}`;
  const mNotProf = expression.match(/^not_proficient_in\(([^)]+)\)$/i);
  if (mNotProf?.[1]) return `${subject} is not proficient in ${humanizeName(mNotProf[1])}`;

  // self:proficient_in_attribute(X) and self:not_proficient_in_attribute(X)
  const mProfAttr = expression.match(/^proficient_in_attribute\(([^)]+)\)$/i);
  if (mProfAttr?.[1]) return `${subject} is proficient in the ${humanizeTag(mProfAttr[1])} attribute`;
  const mNotProfAttr = expression.match(/^not_proficient_in_attribute\(([^)]+)\)$/i);
  if (mNotProfAttr?.[1]) return `${subject} is not proficient in the ${humanizeTag(mNotProfAttr[1])} attribute`;

  // actor/self:stat|vitality_pct|<|0.5  (and >, <=, >=)
  const mVital = expression.match(
    /^stat\|vitality_pct\|(>=|<=|>|<|={1,2})\|(\d+(?:\.\d+)?)$/i,
  );
  if (mVital && mVital[1] && mVital[2]) {
    const op = mVital[1];
    const raw = parseFloat(mVital[2]);
    const pct = Math.round(raw <= 1 ? raw * 100 : raw);
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
    return `${subject} is ${opLabel} ${pct}% vitality`;
  }

  // self:stat|name|<op>|value (generic stat)
  const mStat = expression.match(/^stat\|([^|]+)\|(>=|<=|>|<|={1,2})\|(.+)$/i);
  if (mStat) {
    const stat = humanizeTag(mStat[1] ?? "stat");
    const op = mStat[2];
    const val = humanizeTag(mStat[3] ?? "value");
    const opLabel = op === ">" ? "above" : op === "<" ? "below" : op === ">=" ? "at least" : op === "<=" ? "at most" : "equal to";
    return `${subject}'s ${stat} is ${opLabel} ${val}`;
  }

  if (expression === "is_tracking" || expression === "flag|is_tracking") return `${subject} is tracking an active mark`;
  if (expression === "is_prone" || expression === "prone") return `${subject} is prone`;
  if (expression === "is_stunned" || expression === "stunned") return `${subject} is stunned`;
  if (expression === "mounted") return `${subject} is mounted`;

  if (expression === "not_proficient") return `${subject} is not proficient`;
  if (expression === "proficient") return `${subject} is proficient`;

  // actor:* legacy preset aliases (act on character)
  if (token === "actor:damaged-last-round" || token === "actor-damaged-last-round") return "Actor was damaged last round";
  if (token === "actor:stance" || token === "actor-stance") return "Actor has a stance";
  if (token === "actor-below-half-hp") return "Actor is below 50% vitality";

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
  if (!hasMeaningfulCondition(condition)) return "";
  if (condition.kind === "narrative") return condition.text.trim();
  if (condition.kind === "preset") {
    return [humanReadableToken(condition.presetKey), ...condition.customTags.map(humanReadableToken)]
      .filter(Boolean)
      .join(" AND ");
  }
  if (condition.kind === "tags") {
    return condition.customTags.map(humanReadableToken).filter(Boolean).join(" AND ");
  }
  if (condition.kind === "compound") {
    const rendered = condition.tokens.map(humanReadableToken).filter(Boolean);
    while (rendered[0] === "AND" || rendered[0] === "OR") rendered.shift();
    while (rendered.at(-1) === "AND" || rendered.at(-1) === "OR") rendered.pop();
    return rendered.join(" ");
  }
  return "";
}

function humanizeTag(tag: string): string {
  return tag
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/-/g, " ");
}

function humanizeName(value: string): string {
  const words = humanizeTag(value);
  return words ? `${words[0]?.toUpperCase() ?? ""}${words.slice(1)}` : "";
}
