import type { ModifierContribution } from "./resolve-modifiers";
import { PRACTICE_ATTRIBUTE_MAP } from "./practices";

/** Read both the current keyword token and its older stored representation. */
export function grantedKeyword(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const token = value as {
    kind?: string;
    text?: unknown;
    value?: unknown;
    which?: unknown;
  };
  const raw =
    token.kind === "keyword"
      ? [token.text, token.value].find((v) => typeof v === "string" && v.trim())
      : token.kind === "derived"
        ? token.which
        : null;
  return typeof raw === "string"
    ? raw
        .replace(/^\[+|\]+$/g, "")
        .trim()
        .toLowerCase() || null
    : null;
}

export function practiceGrant(
  value: unknown,
): "proficiency" | "expertise" | null {
  const keyword = grantedKeyword(value);
  return keyword === "expertise"
    ? "expertise"
    : keyword === "pb" ||
        keyword === "proficiency" ||
        keyword === "proficiency_bonus"
      ? "proficiency"
      : null;
}

/** A grant upgrades proficiency; repeated grants do not buy further PB multiples. */
export function resolvePracticeGrants(
  target: string,
  contributions: readonly ModifierContribution[],
  pb: number,
  proficientAttribute: string | null | undefined,
): { contributions: ModifierContribution[]; bonus: number; training: 0 | 1 | 2 } {
  const practice = target.slice("skill_practice_check.".length);
  const attribute = Object.entries(PRACTICE_ATTRIBUTE_MAP).find(([, names]) =>
    (names as readonly string[]).includes(practice),
  )?.[0];
  const active = (c: ModifierContribution) => c.conditionActive && !c.inhibited;
  const baseProficient =
    attribute?.toLowerCase() === proficientAttribute?.toLowerCase();
  // Earlier catalogue expertise pieces used an additive PB token, guarded by
  // proficiency, instead of a grant token. Preserve that authored arithmetic
  // while identifying the active training badge just as the live sheet does.
  // A plain numeric bonus, mirrored penalty or unrelated scope never qualifies.
  const legacyExpertise = (c: ModifierContribution) =>
    active(c) && c.op === "add" && c.value > 0 &&
    practiceGrant(c.rawValue) === "proficiency" &&
    /^expertise\b/i.test(c.primitiveName);
  const numericProficiency = contributions.some(
    (c) =>
      active(c) &&
      c.op === "add" &&
      practiceGrant(c.rawValue) === "proficiency" && !legacyExpertise(c),
  );
  const hasProficiency =
    baseProficient ||
    numericProficiency ||
    contributions.some(
      (c) =>
        active(c) &&
        c.op === "grant" &&
        practiceGrant(c.rawValue) === "proficiency",
    );
  let proficiencyApplied = baseProficient || numericProficiency;
  let expertiseApplied = false;
  let bonus = 0;
  const resolved = contributions.map((c) => {
    const kind = c.op === "grant" ? practiceGrant(c.rawValue) : null;
    if (!kind) return c;
    let value = 0;
    if (active(c)) {
      if (kind === "proficiency" && !proficiencyApplied) {
        value = pb;
        proficiencyApplied = true;
      }
      if (kind === "expertise" && hasProficiency && !expertiseApplied) {
        value = pb;
        expertiseApplied = true;
      }
    }
    bonus += value;
    return { ...c, value, tags: [...new Set([...c.tags, kind])] };
  });
  // Export the same scoped, active grant state that produced the total.
  // Plain numeric bonuses and unrelated grants from the same primitive are not
  // evidence of training in this practice.
  return { contributions: resolved, bonus,
    training: hasProficiency ? expertiseApplied || contributions.some(legacyExpertise) ? 2 : 1 : 0 };
}
