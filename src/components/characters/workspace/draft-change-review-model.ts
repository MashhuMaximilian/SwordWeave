import { BACKSTORY_FIELDS } from "@/lib/character/character-backstory";
import { mirrorConsequence } from "@/lib/character/mirror-suggestions";
import { effectiveAvailability, supplyPaths, type WorkspaceGraph, type WorkspaceNode } from "@/lib/character/workspace/model";
import type { WorkspaceDraftPreview } from "@/lib/character/workspace/draft-types";

export type ReviewPreview = WorkspaceDraftPreview & { beforeGraph?: WorkspaceGraph };
export type ReviewGraphPreview = Pick<ReviewPreview, "graph" | "beforeGraph" | "beforeSnapshot" | "afterSnapshot"> & {results?:WorkspaceDraftPreview["results"]};
export type ReviewChange = { key: string; title: string; before: string; after: string; format?: "markdown" };
export type ReviewPieceChange = { key: string; title: string; status: "Added" | "Removed" | "Changed"; facets: (ReviewChange & { label: string })[] };
export function mechanicalRule(node: WorkspaceNode): string {
  return String(node.data["mechanicalOutputText"] || node.data["mechanicalDescription"] || node.description || "No mechanical rule supplied.");
}
function suppliedRule(graph: WorkspaceGraph, node: WorkspaceNode): string {
  if (node.kind !== "primitive") return mechanicalRule(node);
  const paths = supplyPaths(graph,node.key);
  const mirrored = paths.some(path=>path.edges.at(-1)?.isMirrored);
  const ordinary = !paths.length || paths.some(path=>!path.edges.at(-1)?.isMirrored);
  return [ordinary ? mechanicalRule(node) : "", mirrored ? mirrorConsequence({id:Number(node.id),buCost:node.bu,...node.data}) : ""].filter(Boolean).join("\n");
}
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>`${key}:${stable(item)}`).join(",")}}`;
  return JSON.stringify(value) ?? "";
}
function display(value: unknown): string {
  if (value === null || value === undefined || value === "") return "Not set";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}
function backstoryEntries(value: unknown): Record<string, string> {
  if (typeof value === "string") {
    try { return backstoryEntries(JSON.parse(value)); } catch { return value.trim() ? { origin: value } : {}; }
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].trim() !== ""));
}
function reviewData(node: WorkspaceNode) {
  // A new saved version or storage timestamp is not itself a changed rule.
  const bookkeeping = new Set(["id", "createdAt", "updatedAt", "latestVersionId", "currentVersionId", "versionId", "versionNumber", "contentHash", "userId", "isPublic", "visibility", "sourceOrigin", "workspaceHistoricalVersion"]);
  return Object.fromEntries(Object.entries(node.data).filter(([key]) => !bookkeeping.has(key)));
}
function suppliedNodes(graph: WorkspaceGraph) {
  return new Map<string, WorkspaceNode>(graph.nodes.filter(node => supplyPaths(graph, node.key).length > 0).map(node => [node.key, node]));
}
function location(graph: WorkspaceGraph, node: WorkspaceNode): string {
  return supplyPaths(graph,node.key).map(path => {
    const parts = path.edges.map(edge => graph.nodes.find(n=>n.key===edge.child)?.name ?? edge.child);
    parts.pop();
    return [path.edges[0]?.category.toLowerCase(), ...parts, path.edges.at(-1)?.isMirrored ? "mirrored" : "direct benefit"].filter(Boolean).join(" → ");
  }).sort().join("\n");
}
function supplyState(graph: WorkspaceGraph, node: WorkspaceNode): string {
  const paths = supplyPaths(graph,node.key);
  const state = effectiveAvailability(node.key,paths,[]);
  return state.available ? `Available from ${state.availablePaths.length} ${state.availablePaths.length === 1 ? "source" : "sources"}` : state.reasons.join("; ") || "No source";
}
const foundationLabels: Record<string,string> = {name:"Name",notes:"Character concept / notes",backstory:"Backstory",attrPhysical:"Physical",attrMental:"Mental",attrMagical:"Magical",attrProficient:"Specialty",level:"Level",startingBu:"Starting BU",size:"Size",lineageName:"Lineage",lineageDescription:"Lineage story",upbringingName:"Upbringing",upbringingDescription:"Upbringing story",manifestName:"Manifest"};
/** Compare only actual changed pieces. Repeated sources stay visible through path counts. */
export function draftReviewChanges(preview: ReviewGraphPreview) {
  const beforeGraph = preview.beforeGraph ?? preview.beforeSnapshot?.graph;
  const afterGraph = preview.afterSnapshot?.graph ?? preview.graph;
  const rules: ReviewChange[] = [], placements: ReviewChange[] = [], sources: ReviewChange[] = [], foundation: ReviewChange[] = [];
  const beforeNodes = beforeGraph ? suppliedNodes(beforeGraph) : new Map<string,WorkspaceNode>();
  const afterNodes = suppliedNodes(afterGraph);
  if (beforeGraph) {
    const origins=new Map<string,string>();
    for(const entry of preview.results??[]) for(const [source,next] of Object.entries((entry.result['replacements']??{}) as Record<string,string>)) origins.set(next,origins.get(source)??source);
    for(const [key,node] of [...afterNodes]) {const original=origins.get(key);if(original&&beforeNodes.has(original)&&!afterNodes.has(original)){afterNodes.delete(key);afterNodes.set(original,node);}}
    for (const key of new Set([...beforeNodes.keys(),...afterNodes.keys()])) {
      const old = beforeNodes.get(key), next = afterNodes.get(key);
      const title = next?.name ?? old!.name;
      if (!old || !next || old.name !== next.name || old.bu !== next.bu || stable(reviewData(old)) !== stable(reviewData(next)) || old.description !== next.description || suppliedRule(beforeGraph,old) !== suppliedRule(afterGraph,next)) {
        rules.push({key,title,before:old ? `${suppliedRule(beforeGraph,old)}\n${old.bu} BU` : "Not in this build",after:next ? `${suppliedRule(afterGraph,next)}\n${next.bu} BU` : "Removed from this build"});
      }
      const oldLocation = old ? location(beforeGraph,old) : "Not in this build";
      const nextLocation = next ? location(afterGraph,next) : "Removed from this build";
      if (oldLocation !== nextLocation) placements.push({key,title,before:oldLocation,after:nextLocation});
      const oldSource = old ? supplyState(beforeGraph,old) : "No source";
      const nextSource = next ? supplyState(afterGraph,next) : "No source";
      if (oldSource !== nextSource) sources.push({key,title,before:oldSource,after:nextSource});
    }
  }
  const oldFoundation = preview.beforeSnapshot?.foundation, nextFoundation = preview.afterSnapshot?.foundation;
  if (oldFoundation && nextFoundation) for (const key of new Set([...Object.keys(oldFoundation),...Object.keys(nextFoundation)])) {
    const isBackstory = key === "backstory";
    const old = isBackstory ? backstoryEntries(oldFoundation[key]) : oldFoundation[key];
    const next = isBackstory ? backstoryEntries(nextFoundation[key]) : nextFoundation[key];
    if (isBackstory) {
      const before = old as Record<string,string>, after = next as Record<string,string>;
      for (const field of new Set([...Object.keys(before), ...Object.keys(after)])) {
        if ((before[field] ?? "") === (after[field] ?? "")) continue;
        foundation.push({key:`backstory.${field}`, title:BACKSTORY_FIELDS.find(item=>item.key===field)?.label ?? (field === "manifestDescription" ? "Manifest story" : field), before:before[field] || "Not set", after:after[field] || "Not set", format:"markdown"});
      }
      continue;
    }
    if (stable(old) !== stable(next)) foundation.push({key,title:foundationLabels[key] ?? key.replace(/([A-Z])/g," $1"),before:display(old),after:display(next),...((isBackstory || key === "notes" || key.endsWith("Description")) ? {format:"markdown" as const} : {})});
  }
  const pieces = new Map<string, ReviewPieceChange>();
  const oldSupplied = beforeNodes;
  const nextSupplied = afterNodes;
  for (const [label, facets] of [["Rule", rules], ["Placement", placements], ["Availability", sources]] as const) for (const facet of facets) {
    const piece: ReviewPieceChange = pieces.get(facet.key) ?? { key: facet.key, title: facet.title, status: !oldSupplied.has(facet.key) ? "Added" : !nextSupplied.has(facet.key) ? "Removed" : "Changed", facets: [] };
    piece.facets.push({ ...facet, label });
    pieces.set(facet.key, piece);
  }
  return {rules,placements,sources,foundation,pieces:[...pieces.values()],hasBeforeGraph:!!beforeGraph};
}

/** Net changed pieces and character fields, independent of intermediate edits/undo history. */
export function draftReviewChangeCount(preview: ReviewGraphPreview): number | null {
  const changes = draftReviewChanges(preview);
  return changes.hasBeforeGraph ? changes.pieces.length + changes.foundation.length : null;
}
