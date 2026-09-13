import type { ForkMapNode, ForkMapResult } from "./fork-map";

export interface ForkMapSession {
  nodes: ForkMapNode[];
  edges: ForkMapResult["edges"];
}

/** Exploration adds to the canvas. It never discards already opened branches. */
export function mergeForkMap(session: ForkMapSession, page: ForkMapResult): ForkMapSession {
  const nodes = new Map(session.nodes.map(node => [node.key, node]));
  for (const node of [...page.ancestry, page.selected, ...page.children]) {
    const previous = nodes.get(node.key);
    nodes.set(node.key, { ...node, authorName: node.authorName ?? previous?.authorName ?? null });
  }
  const edges = new Map([...session.edges, ...page.edges].map(edge => [JSON.stringify([edge.from, edge.to]), edge]));
  return {nodes: [...nodes.values()].map(node => ({...node, relation: node.key === page.selected.key ? "selected" : "child"})), edges:[...edges.values()]};
}

/** Stable insertion order within each generation; cycle-safe for legacy records. */
export function layoutForkMap(session: ForkMapSession) {
  const parents = new Map<string,string[]>();
  for (const edge of session.edges) parents.set(edge.to,[...(parents.get(edge.to) ?? []),edge.from]);
  const depths = new Map<string,number>();
  function depth(key: string, visited = new Set<string>()): number {
    if (depths.has(key)) return depths.get(key)!;
    if (visited.has(key)) return 0;
    const next = new Set(visited).add(key);
    const value = Math.max(0,...(parents.get(key) ?? []).map(parent => depth(parent,next)+1));
    depths.set(key,value);
    return value;
  }
  const rows = new Map<number,number>();
  return session.nodes.map(node => {
    const column = depth(node.key), row = rows.get(column) ?? 0;
    rows.set(column,row+1);
    return {node,x:30+column*250,y:30+row*290};
  });
}
