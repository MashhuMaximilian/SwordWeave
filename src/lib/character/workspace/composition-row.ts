import type { EntityKey, WorkspaceGraph, WorkspaceNode } from './model';

/** Forms and previews must use the same complete graph, including nested containers. */
export function compositionRow(graph: WorkspaceGraph, node: WorkspaceNode, seen: EntityKey[] = []): Record<string, unknown> {
  const row: Record<string, unknown> = {...node.data,id:node.kind==='primitive'?Number(node.id):node.id,name:node.name,buCost:node.bu,tags:node.data['tags']??[],primitiveLinks:[],effectLinks:[],capabilityLinks:[]};
  if(seen.includes(node.key))return row;
  for(const kind of ['primitive','effect','capability'] as const){
    row[`${kind}Links`]=graph.edges.filter(e=>e.parent===node.key && e.child.startsWith(`${kind}:`)).sort((a,b)=>a.order-b.order).flatMap(edge=>{
      const child=graph.nodes.find(n=>n.key===edge.child);
      return child?[{...edge.data,[`${kind}Id`]:kind==='primitive'?Number(child.id):child.id,[kind]:compositionRow(graph,child,[...seen,node.key]),quantity:edge.data?.['quantity']??1,isMirrored:edge.isMirrored}]:[];
    });
  }
  return row;
}
