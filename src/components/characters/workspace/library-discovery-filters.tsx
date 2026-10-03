"use client";

export const EMPTY_DISCOVERY_FILTERS = { minBu: "", maxBu: "", tags: "", definitionKind: "", mirrorableOnly: false, mechanicTarget: "", recipient: "", conditionMode: "", minMagnitude: "", maxMagnitude: "" };
export type DiscoveryFilters = typeof EMPTY_DISCOVERY_FILTERS;
export function discoveryFilterParams(filters: DiscoveryFilters) {
  const params: Record<string, string> = {};
  if (filters.minBu !== "") params["minBu"] = filters.minBu;
  if (filters.maxBu !== "") params["maxBu"] = filters.maxBu;
  if (filters.tags.trim()) params["tags"] = filters.tags.trim();
  if (filters.definitionKind) params["definitionKind"] = filters.definitionKind;
  if (filters.mirrorableOnly) params["mirrorableOnly"] = "1";
  for (const key of ["mechanicTarget", "recipient", "conditionMode", "minMagnitude", "maxMagnitude"] as const) if (filters[key] !== "") params[key] = filters[key];
  return params;
}
export function LibraryDiscoveryFilters({ value, onChange, primitive, sort, onSortChange }: {
  value: DiscoveryFilters; onChange: (value: DiscoveryFilters) => void; primitive: boolean; sort: string; onSortChange: (value: string) => void;
}) {
  const patch = (change: Partial<DiscoveryFilters>) => onChange({ ...value, ...change });
  return <div className="grid grid-cols-2 gap-3">
    <label className="sheet-field">Sort<select value={sort} onChange={(event) => onSortChange(event.target.value)}>
      <option value="ALPHABETICAL">Name A–Z</option><option value="ALPHABETICAL_DESC">Name Z–A</option><option value="BU">BU: low to high</option><option value="BU_DESC">BU: high to low</option><option value="RECENT">Newest</option><option value="LIKES">Most liked</option><option value="FORKS">Most adapted</option><option value="ENGAGEMENT">Popular</option>
    </select></label>
    <label className="sheet-field">Tags<input value={value.tags} onChange={(event) => patch({ tags: event.target.value })} placeholder="e.g. fire, movement"/><small>Comma separated; requires every tag.</small></label>
    <label className="sheet-field">Minimum BU<input type="number" min="0" step="any" value={value.minBu} onChange={(event) => patch({ minBu: event.target.value })} placeholder="Any"/></label>
    <label className="sheet-field">Maximum BU<input type="number" min="0" step="any" value={value.maxBu} onChange={(event) => patch({ maxBu: event.target.value })} placeholder="Any"/></label>
    {primitive && <><label className="sheet-field">What it changes<input value={value.mechanicTarget} onChange={(event) => patch({ mechanicTarget: event.target.value })} placeholder="physical, speed, slots…"/></label>
      <label className="sheet-field">Recipient<select value={value.recipient} onChange={(event) => patch({ recipient: event.target.value })}><option value="">Anyone</option><option value="self">Self</option><option value="target">Target</option><option value="scene">Scene</option></select></label>
      <label className="sheet-field">When it applies<select value={value.conditionMode} onChange={(event) => patch({ conditionMode: event.target.value })}><option value="">Any trigger</option><option value="always">Always active</option><option value="conditional">Has an authored condition</option></select></label>
      <label className="sheet-field">Minimum fixed magnitude<input type="number" step="any" value={value.minMagnitude} onChange={(event) => patch({ minMagnitude: event.target.value })} placeholder="Any"/><small>Fixed numbers only; formulas and dice excluded.</small></label>
      <label className="sheet-field">Maximum fixed magnitude<input type="number" step="any" value={value.maxMagnitude} onChange={(event) => patch({ maxMagnitude: event.target.value })} placeholder="Any"/></label>
      <label className="sheet-field">Primitive layer<select value={value.definitionKind} onChange={(event) => patch({ definitionKind: event.target.value })}><option value="">All primitives</option><option value="TEMPLATE">Family bases</option><option value="EXPRESSION">Specific expressions</option></select></label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={value.mirrorableOnly} onChange={(event) => patch({ mirrorableOnly: event.target.checked })}/>Can be mirrored</label></>}
    {value.minBu !== "" && value.maxBu !== "" && Number(value.minBu) > Number(value.maxBu) && <p role="status" className="col-span-2 text-sm">Minimum BU exceeds maximum BU. Adjust either value to see matches.</p>}
  </div>;
}
