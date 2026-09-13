"use client";

import { useState } from "react";

export function PrimitiveTargetChoices({ label, options, labels, selected, onToggle }: {
  label: string;
  options: readonly string[];
  labels: Readonly<Record<string, string>>;
  selected: readonly string[];
  onToggle: (value: string, checked: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  // Keep loaded custom/legacy values visible and removable even outside today's catalog.
  const choices = [...new Set([...selected, ...options])];
  const visible = choices.filter(value => selected.includes(value) || `${labels[value] ?? value} ${value}`.toLowerCase().includes(query.toLowerCase().trim()));
  return <div className="v12-target-presets space-y-2">
    <p>{label} · {selected.length ? `${selected.length} selected` : "No presets selected"}</p>
    <input className="w-full min-h-10 rounded-md px-3 text-base" aria-label={`Search ${label} presets`} placeholder="Search presets…" value={query} onChange={event => setQuery(event.target.value)} />
    <div className="v12-choice-chips" aria-label={`${label} choices`}>
      {visible.map(value => <button key={value} type="button" aria-pressed={selected.includes(value)} onClick={() => onToggle(value, !selected.includes(value))}>{labels[value] ?? value}</button>)}
    </div>
    {!visible.length ? <p role="status">No matching presets.</p> : null}
    <p className="v12-target-hint">Choose one or more presets. Without presets or a custom value, this applies to any {label.toLowerCase()}.</p>
  </div>;
}
