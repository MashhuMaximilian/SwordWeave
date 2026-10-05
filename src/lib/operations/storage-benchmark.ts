export interface StorageSample { name: string; rows: number; heapBytes: number; indexBytes: number; totalBytes: number; averageRowBytes: number; indexCount?: number; }
/** Planning estimate using measured row bytes and measured index/data ratios.
 * Page slack from small tables is reported separately, not extrapolated per user. */
export function estimateBenchmark(samples: StorageSample[], users = 1000, versionsPerEntry = 3) {
  const counts: Record<string, number> = { characters: 10, primitives: 50, capabilities: 30, effects: 30, heritage: 30, items: 30 };
  const versions: Record<string,string> = {characters:"character_versions",primitives:"primitive_versions",capabilities:"capability_versions",effects:"effect_versions",heritage:"heritage_versions",items:"item_versions"};
  const byName = new Map(samples.map(s=>[s.name,s]));
  let authoredBytes=0,versionBytes=0,indexBytes=0,relationshipBytes=0;
  // Every tiny B-tree occupies pages even with almost no entries. Do not
  // multiply those fixed pages by 1,000 users. For undersampled tables use
  // 64 bytes per index entry; otherwise scale measured occupied bytes.
  const projectedIndexes = (s: StorageSample | undefined, rows: number) => {
    const count = s?.indexCount ?? 2;
    const perRow = s && s.rows >= 1000
      ? Math.max(64 * count, (s.indexBytes - 8192 * count) / s.rows)
      : 64 * count;
    return rows * perRow + count * 8192;
  };
  for(const [name,count] of Object.entries(counts)) {
    const sample=byName.get(name); const version=byName.get(versions[name]!);
    const raw=(sample?.averageRowBytes??1024)*count*users;
    const versionRaw=(version?.averageRowBytes??2048)*count*users*versionsPerEntry;
    authoredBytes+=raw;versionBytes+=versionRaw;
    indexBytes += projectedIndexes(sample, count * users) + projectedIndexes(version, count * users * versionsPerEntry);
  }
  // Scale observed composition density; links remain references.
  for(const s of samples.filter(s=>/^(character|capability|effect|item|heritage)_(primitives|capabilities|effects|items|heritages)$/.test(s.name))) {
    const prefix=s.name.split("_")[0]; const parent=prefix==="heritage"?"heritage":`${prefix}s`; const parentRows=byName.get(parent)?.rows??0;
    if(!parentRows||!counts[parent!])continue;
    const raw=s.averageRowBytes*s.rows/parentRows*counts[parent!]!*users;
    relationshipBytes+=raw;indexBytes+=projectedIndexes(s, s.rows/parentRows*counts[parent!]!*users);
  }
  const sessionBytes=users*10*5*1024;
  // Include fresh collection/state indexes even when tables have no usage sample.
  const newFeatureAllowance=users*10*512;
  const subtotal=authoredBytes+versionBytes+relationshipBytes+indexBytes+sessionBytes+newFeatureAllowance;
  return {users,versionsPerEntry,authoredBytes,versionBytes,relationshipBytes,indexBytes,sessionBytes,newFeatureAllowance,
    estimatedBytes:Math.ceil(subtotal*1.25),overheadFraction:.25,
    assumptions:["Current measured composition density and row sizes; authored descriptions may grow.","Three versions per entry by default; use 1/3/5 comparison.","Index model removes fixed page allocation; undersampled tables use 64 bytes per index entry plus one 8 KiB page per index. Validate again after growth.","5 KiB current play state for each of 10 characters per user.","25% reserve for tuple/page slack, collection/state growth and index overhead; not a capacity guarantee.","Excludes media objects, provider restore history and unlimited activity history."]};
}
