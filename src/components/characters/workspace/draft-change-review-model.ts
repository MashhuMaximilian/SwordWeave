import { mirrorConsequence } from "@/lib/character/mirror-suggestions";
import { effectiveAvailability, supplyPaths, type WorkspaceGraph, type WorkspaceNode } from "@/lib/character/workspace/model";
import type { WorkspaceDraftPreview } from "@/lib/character/workspace/draft-types";

export type ReviewPreview = WorkspaceDraftPreview & { beforeGraph?: WorkspaceGraph };
export type ReviewGraphPreview = Pick<ReviewPreview, "graph" | "beforeGraph" | "beforeSnapshot" | "afterSnapshot">;
export type ReviewChange = { key: string; title: string; before: string; after: string };
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
  if (beforeGraph) {
    const beforeNodes = new Map(beforeGraph.nodes.map(node=>[node.key,node]));
    const afterNodes = new Map(afterGraph.nodes.map(node=>[node.key,node]));
    for (const key of new Set([...beforeNodes.keys(),...afterNodes.keys()])) {
      const old = beforeNodes.get(key), next = afterNodes.get(key);
      const title = next?.name ?? old!.name;
      if (!old || !next || old.name !== next.name || old.bu !== next.bu || old.versionId !== next.versionId || stable(old.data) !== stable(next.data) || old.description !== next.description || suppliedRule(beforeGraph,old) !== suppliedRule(afterGraph,next)) {
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
    if (stable(oldFoundation[key]) !== stable(nextFoundation[key])) foundation.push({key,title:foundationLabels[key] ?? key.replace(/([A-Z])/g," $1"),before:display(oldFoundation[key]),after:display(nextFoundation[key])});
  }
  return {rules,placements,sources,foundation,hasBeforeGraph:!!beforeGraph};
}
