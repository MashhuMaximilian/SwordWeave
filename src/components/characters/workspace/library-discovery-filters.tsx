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
  const mechanicsCount = [value.mechanicTarget, value.recipient, value.conditionMode, value.minMagnitude, value.maxMagnitude, value.definitionKind, value.mirrorableOnly].filter(Boolean).length;
  return <div className="sw-discovery-filters">
    <div className="sw-discovery-filters__basics">
      <label className="sw-discovery-field sw-discovery-field--sort"><span>Sort entries</span><select value={sort} onChange={(event) => onSortChange(event.target.value)}>
        <option value="ALPHABETICAL">Name A–Z</option><option value="ALPHABETICAL_DESC">Name Z–A</option><option value="BU">BU: low to high</option><option value="BU_DESC">BU: high to low</option><option value="RECENT">Newest</option><option value="LIKES">Most liked</option><option value="FORKS">Most adapted</option><option value="ENGAGEMENT">Popular</option>
      </select></label>
      <fieldset className="sw-discovery-range"><legend>BU budget</legend><div className="sw-discovery-range__inputs">
        <label className="sw-discovery-field"><span>From</span><input type="number" min="0" step="any" value={value.minBu} onChange={(event) => patch({ minBu: event.target.value })} placeholder="Any"/></label>
        <span className="sw-discovery-range__divider" aria-hidden="true">—</span>
        <label className="sw-discovery-field"><span>To</span><input type="number" min="0" step="any" value={value.maxBu} onChange={(event) => patch({ maxBu: event.target.value })} placeholder="Any"/></label>
      </div></fieldset>
    </div>
    {value.minBu !== "" && value.maxBu !== "" && Number(value.minBu) > Number(value.maxBu) && <p role="status" className="sw-discovery-note">From exceeds To. Adjust the budget range to see matches.</p>}
    {primitive && <details className="sw-discovery-section">
      <summary><span><strong>Mechanical rules</strong><small>Result, recipient, trigger and magnitude</small></span><span className="sw-discovery-section__end">{mechanicsCount > 0 && <em>{mechanicsCount} active</em>}<span className="sw-discovery-section__chevron" aria-hidden="true">⌄</span></span></summary>
      <div className="sw-discovery-section__body">
        <label className="sw-discovery-field"><span>What it changes</span><input value={value.mechanicTarget} onChange={(event) => patch({ mechanicTarget: event.target.value })} placeholder="physical, speed, slots…"/></label>
        <div className="sw-discovery-pair">
          <label className="sw-discovery-field"><span>Recipient</span><select value={value.recipient} onChange={(event) => patch({ recipient: event.target.value })}><option value="">Anyone</option><option value="self">Self</option><option value="target">Target</option><option value="scene">Scene</option></select></label>
          <label className="sw-discovery-field"><span>When it applies</span><select value={value.conditionMode} onChange={(event) => patch({ conditionMode: event.target.value })}><option value="">Any trigger</option><option value="always">Always active</option><option value="conditional">Has an authored condition</option></select></label>
        </div>
        <fieldset className="sw-discovery-range"><legend>Fixed magnitude</legend><div className="sw-discovery-range__inputs">
          <label className="sw-discovery-field"><span>From</span><input type="number" step="any" value={value.minMagnitude} onChange={(event) => patch({ minMagnitude: event.target.value })} placeholder="Any"/></label>
          <span className="sw-discovery-range__divider" aria-hidden="true">—</span>
          <label className="sw-discovery-field"><span>To</span><input type="number" step="any" value={value.maxMagnitude} onChange={(event) => patch({ maxMagnitude: event.target.value })} placeholder="Any"/></label>
        </div><p className="sw-discovery-hint">Fixed numbers only; formulas and dice are excluded.</p></fieldset>
        <label className="sw-discovery-field"><span>Primitive layer</span><select value={value.definitionKind} onChange={(event) => patch({ definitionKind: event.target.value })}><option value="">All primitives</option><option value="TEMPLATE">Family bases</option><option value="EXPRESSION">Specific expressions</option></select></label>
        <label className="sw-discovery-check"><input type="checkbox" checked={value.mirrorableOnly} onChange={(event) => patch({ mirrorableOnly: event.target.checked })}/><span>Can be mirrored</span></label>
      </div>
    </details>}
    <details className="sw-discovery-section">
      <summary><span><strong>Tags</strong><small>Narrow the collection by its themes</small></span><span className="sw-discovery-section__end">{value.tags.trim() && <em>Active</em>}<span className="sw-discovery-section__chevron" aria-hidden="true">⌄</span></span></summary>
      <div className="sw-discovery-section__body"><label className="sw-discovery-field"><span>Required tags</span><input value={value.tags} onChange={(event) => patch({ tags: event.target.value })} placeholder="e.g. fire, movement"/><small>Comma separated; each tag must match.</small></label></div>
    </details>
  </div>;
}
