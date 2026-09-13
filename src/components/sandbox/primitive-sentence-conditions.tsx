"use client";

import type { ConditionAuthoring } from "@/types/condition";
import { removeConditionClause } from "@/lib/primitives/condition-authoring";

export function PrimitiveSentenceConditions({ value, expanded, onEdit, onChange }: {
  value: ConditionAuthoring;
  expanded: boolean;
  onEdit: () => void;
  onChange: (value: ConditionAuthoring) => void;
}) {
  const hasCondition = value.pills.length > 0 || Boolean(value.narrative.trim());
  return <>
    {hasCondition ? <span className="v12-condition-join">when</span> : null}
    {value.pills.map((pill, index) => <span className="v12-inline-clause" key={`${index}:${pill.label}`}>
      {index > 0 ? <button type="button" className="v12-condition-join" aria-label={`Change ${value.operators[index - 1] ?? "AND"} before ${pill.label}`} onClick={() => {
        const operators = value.pills.slice(1).map((_, i) => value.operators[i] ?? "AND");
        operators[index - 1] = operators[index - 1] === "AND" ? "OR" : "AND";
        onChange({ ...value, operators });
      }}>{value.operators[index - 1] ?? "AND"}</button> : null}
      <button type="button" className="v12-phrase v12-sentence__target" aria-expanded={expanded} onClick={onEdit}>{pill.label}</button>
      <button type="button" className="v12-clause-remove" aria-label={`Remove condition ${pill.label}`} onClick={() => onChange(removeConditionClause(value, index))}>×</button>
    </span>)}
    {value.narrative.trim() ? <><span>{value.pills.length ? ";" : ""}</span><button type="button" className="v12-phrase" aria-expanded={expanded} onClick={onEdit}>{value.narrative}</button></> : null}
    <button type="button" className="v12-metal-button" aria-expanded={expanded} onClick={onEdit}>{hasCondition ? "+ condition" : "+ when"}</button>
  </>;
}
