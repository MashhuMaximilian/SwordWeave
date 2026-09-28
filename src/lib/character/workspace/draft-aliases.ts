import { createHash } from "node:crypto";
import type { WorkspaceGraph } from "./model";

/** Stable virtual identities let later draft actions refer to newly authored
 * pieces even though preview transactions are rolled back. */
export function virtualIdentity(operationId: string, discriminator: string, numeric = false): string {
  const hex = createHash("sha256").update(`${operationId}:${discriminator}`).digest("hex");
  if (numeric) return String(-parseInt(hex.slice(0, 12), 16));
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
export function mapDraftIdentities<T>(value: T, identities: ReadonlyMap<string, string>, field = ""): T {
  if (typeof value === "number") {
    if (!["id", "primitiveId", "sourceId", "primitiveIds", "existingId"].includes(field)) return value;
    const next = identities.get(String(value));
    return (next === undefined ? value : Number(next)) as T;
  }
  if (typeof value === "string") {
    if (identities.has(value)) return identities.get(value)! as T;
    // Graph keys and composed membership IDs are colon-separated identities.
    if (/^(primitive|effect|capability|heritage|item|LINEAGE|UPBRINGING|MANIFEST|ITEM|ALL):/.test(value))
      return value.split(":").map(part => identities.get(part) ?? part).join(":") as T;
    return value;
  }
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map(item => mapDraftIdentities(item, identities, field)) as T;
  if (value && typeof value === "object")
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [mapDraftIdentities(key, identities), mapDraftIdentities(item, identities, key)])) as T;
  return value;
}
export function registerDraftIdentities(before: WorkspaceGraph, after: WorkspaceGraph, operationId: string, aliases: Map<string, string>, newEntityIds?: ReadonlySet<string>) {
  const known = new Set(before.nodes.map(n => n.key));
  const counters: Record<string, number> = {};
  for (const node of after.nodes) {
    if ((newEntityIds && !newEntityIds.has(node.id)) || known.has(node.key) || [...aliases.values()].includes(node.id)) continue;
    const count = counters[node.kind] ?? 0;
    counters[node.kind] = count + 1;
    aliases.set(virtualIdentity(operationId, `${node.kind}:${count}`, node.kind === "primitive"), node.id);
  }
  const oldInstances = new Set(before.edges.map(e => e.instanceId).filter(Boolean));
  after.edges.filter(e => e.instanceId && !oldInstances.has(e.instanceId)).forEach((edge, index) => {
    if (![...aliases.values()].includes(edge.instanceId!))
      aliases.set(virtualIdentity(operationId, `instance:${index}`), edge.instanceId!);
  });
}

/** Resolve browser placeholders exclusively from this operation's validated result. */
export function registerLocalBindings(bindings: import('./local-draft').LocalBindings | undefined, before: WorkspaceGraph, after: WorkspaceGraph, result: Record<string,unknown>, aliases: Map<string,string>) {
  if (!bindings) return;
  const replacements=(result['replacements']??{}) as Record<string,string>;
  const bind=(local:string,actual:string)=>{ if(local===actual)return; if(before.nodes.some(n=>n.id===local)||before.edges.some(e=>e.instanceId===local))throw new Error('Invalid browser draft identity.'); aliases.set(local,actual); };
  for(const ref of bindings.nodes) {
    const source=ref.source ? mapDraftIdentities(ref.source,aliases) : undefined;
    const actualKey=source ? replacements[source]??source : result['savedKey'];
    const node=after.nodes.find(n=>n.key===actualKey);
    if(!node || node.kind!==ref.key.split(':')[0]) throw new Error('Could not reconcile this local piece. Keep the browser draft and retry review.');
    bind(ref.key.slice(ref.key.indexOf(':')+1),node.id);
  }
  const used=new Set<string>();
  for(const ref of bindings.instances) {
    const child=mapDraftIdentities(ref.child,aliases);
    const candidates=after.edges.filter(e=>!e.parent&&e.child===child&&e.category===ref.category&&e.isMirrored===ref.isMirrored&&e.instanceId&&!used.has(e.instanceId));
    const edge=candidates.find(e=>!before.edges.some(old=>old.instanceId===e.instanceId))??candidates[0];
    if(!edge?.instanceId)throw new Error('Could not reconcile this local placement. Keep the browser draft and retry review.');
    bind(ref.id,edge.instanceId);used.add(edge.instanceId);
  }
}
