import { Markdown } from "@/components/ui/markdown";
import { collectMechanicalSummary } from "@/lib/primitives/mechanical-summary";

/** One reading surface for the primitive rules carried by a composite entry. */
export function MechanicalSummary({ row }: { row: unknown }) {
  const rules = collectMechanicalSummary(row);
  if (!rules.length) return null;
  return <details className="sw-mechanical-summary" open>
    <summary><span>Mechanical summary</span><span>{rules.length} {rules.length === 1 ? "rule" : "rules"}</span></summary>
    <ul>{rules.map((rule, index) => <li key={`${rule.path}:${index}`} title={rule.path}>
      <Markdown copyRole={rule.mechanical ? "mechanical" : "narrative"}>{rule.text}</Markdown>
      {rule.quantity > 1 || rule.mirrored ? <small>{[rule.quantity > 1 ? `×${rule.quantity}` : "", rule.mirrored ? "Mirrored" : ""].filter(Boolean).join(" · ")}</small> : null}
    </li>)}</ul>
  </details>;
}
