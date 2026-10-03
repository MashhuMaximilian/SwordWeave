import type { LibraryItem } from "./library-query";
import type { LibraryToolbarState } from "@/components/library/library-toolbar";
import { canonicalLibraryCategory, libraryOrigin, libraryTier } from "./library-classification";

const groups: Record<string, string[]> = {
  GROUP_MECHANICS: ["PRIMITIVE", "EFFECT", "CAPABILITY"],
  GROUP_HERITAGES: ["LINEAGE_TEMPLATE", "UPBRINGING_TEMPLATE", "MANIFEST_TEMPLATE"],
};

/** Client filtering shares the public browser's all-required-tags semantics. */
export function matchesLibraryFilters(item: LibraryItem, state: LibraryToolbarState): boolean {
  if (state.origin && state.origin !== "all" && libraryOrigin(item) !== state.origin) return false;
  if (state.tier && libraryTier(item) !== Number(state.tier)) return false;
  if (state.typeFilter !== "ALL" && !(groups[state.typeFilter] ?? [state.typeFilter]).includes(item.targetType)) return false;
  if (state.category && canonicalLibraryCategory(item.familyKey ?? item.category ?? "") !== canonicalLibraryCategory(state.category)) return false;
  if (state.definitionKind && (item.targetType !== "PRIMITIVE" || item.definitionKind !== state.definitionKind)) return false;
  if (state.mechanicTarget && !(item.mechanicTargets ?? []).some(target => target.toLowerCase().includes(state.mechanicTarget!.trim().toLowerCase()))) return false;
  if (state.recipient && !(item.recipients ?? []).includes(state.recipient.toUpperCase())) return false;
  if (state.conditionMode && (item.targetType !== "PRIMITIVE" || item.conditional !== (state.conditionMode === "conditional"))) return false;
  if (state.minMagnitude?.trim() || state.maxMagnitude?.trim()) {
    const min = state.minMagnitude?.trim() && Number.isFinite(Number(state.minMagnitude)) ? Number(state.minMagnitude) : -Infinity;
    const max = state.maxMagnitude?.trim() && Number.isFinite(Number(state.maxMagnitude)) ? Number(state.maxMagnitude) : Infinity;
    if (!(item.magnitudes ?? []).some(value => value >= min && value <= max)) return false;
  }
  if (state.mirrorableOnly && !item.mirrorable) return false;
  if (state.visibility && state.visibility !== "ANY" && (item.visibility ?? "PUBLIC") !== state.visibility) return false;
  if (state.author && ![item.authorUsername, item.authorDisplayName, libraryOrigin(item) === "system" ? "system srd" : ""].join(" ").toLowerCase().includes(state.author.trim().toLowerCase())) return false;
  for (const [raw, actual, isMin] of [[state.minBu, item.buCost, true], [state.maxBu, item.buCost, false], [state.minLikes, item.likesCount, true], [state.minForks, item.forkCount, true]] as const) {
    if (raw?.trim() && Number.isFinite(Number(raw)) && (actual == null || (isMin ? actual < Number(raw) : actual > Number(raw)))) return false;
  }
  if (state.hasForks && item.forkCount < 1) return false;
  const timestamp = item.publishedAt ? new Date(item.publishedAt).getTime() : null;
  if (state.fromDate && (timestamp == null || timestamp < new Date(`${state.fromDate}T00:00:00Z`).getTime())) return false;
  if (state.toDate && (timestamp == null || timestamp >= new Date(`${state.toDate}T00:00:00Z`).getTime() + 86400000)) return false;
  const tags = new Set((item.tags ?? []).map(tag => tag.toLowerCase()));
  if ((state.tags ?? "").split(",").map(tag => tag.trim().toLowerCase()).filter(Boolean).some(tag => !tags.has(tag))) return false;
  const words = state.search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length) {
    const haystack = [item.name, item.description, item.mechanicalDescription, item.mechanicalTemplate, item.verboseDescription, item.compositionSummary, item.category, item.familyKey, item.familyLabel, item.targetType, ...item.tags].join("\n").toLowerCase();
    if (!words.every(word => haystack.includes(word))) return false;
  }
  return true;
}
