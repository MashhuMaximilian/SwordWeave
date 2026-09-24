"use client";
import { draftReviewChanges, type ReviewChange, type ReviewPreview } from "./draft-change-review-model";

/** Shared review for the owner's draft and a collaborator's proposed changes. */
export function DraftChangeReview({preview}: {preview: ReviewPreview}) {
  const before = preview.beforeSheet, after = preview.sheet;
  const changes = draftReviewChanges(preview);
  const rows: [string,number,number][] = [
    ["Allocated BU",before.buLedger.positiveSpent,after.buLedger.positiveSpent],
    ["Drawback credit",before.volatility.rating,after.volatility.rating],
    ["Available BU",before.buLedger.remaining,after.buLedger.remaining],
    ["Maximum vitality",before.vitality.max,after.vitality.max],
    ["Carry capacity",before.carryCapacity,after.carryCapacity],
    ...after.defensiveDCs.map(value => [`${value.attribute.toLowerCase()} defense`,before.defensiveDCs.find(old=>old.attribute===value.attribute)?.dc??0,value.dc] as [string,number,number]),
    ...after.practices.map(value=>[value.practice,before.practices.find(old=>old.practice===value.practice)?.total??0,value.total] as [string,number,number]),
    ...Object.keys(after.speedByType).map(key=>[`${key.toLowerCase()} speed`,before.speedByType[key]??0,after.speedByType[key]??0] as [string,number,number]),
  ];
  const changedRows=rows.filter(row=>row[1]!==row[2]);
  return <section className="my-4 space-y-3" aria-label="Draft change review">
    <h3 className="font-semibold text-[var(--sw-gold,#e6c778)]">What changes</h3>
    {changedRows.length ? <table className="w-full text-left text-sm"><caption className="sr-only">Changed character totals</caption><thead><tr><th scope="col">Result</th><th scope="col">Before</th><th scope="col">After</th></tr></thead><tbody>{changedRows.map(([label,old,next])=><tr key={label} className="border-t border-border"><th scope="row" className="py-1 font-normal">{label}</th><td>{old}</td><td>{next}</td></tr>)}</tbody></table> : <p className="text-sm text-muted-foreground">Character totals are unchanged.</p>}
    <ChangeGroup title="Character details" changes={changes.foundation}/>
    <ChangeGroup title="Rules added, edited, or removed" changes={changes.rules}/>
    <ChangeGroup title="Placement changes" changes={changes.placements}/>
    <ChangeGroup title="Source availability changes" changes={changes.sources}/>
    {!changes.hasBeforeGraph && <p className="text-sm text-muted-foreground">Refresh the preview to compare individual pieces and their placement.</p>}
    {changes.sources.length>0 && <p className="text-xs text-muted-foreground">Source comparison reflects build placement and equipment. Temporary restrictions and local play toggles can still affect live availability.</p>}
    {preview.warnings?.map((warning,index)=><p className="text-sm text-amber-200" key={index}>{warning}</p>)}
  </section>;
}
function ChangeGroup({title,changes}: {title:string;changes:ReviewChange[]}) {
  if (!changes.length) return null;
  return <details className="rounded-md border border-border p-3" open={changes.length<=3}>
    <summary className="cursor-pointer text-sm font-semibold">{title} · {changes.length}</summary>
    <div className="mt-2 space-y-2">{changes.map(change=><article key={change.key} className="border-t border-border pt-2 text-sm"><h4 className="font-semibold">{change.title}</h4><div className="mt-1 grid gap-2 md:grid-cols-2"><div><span className="text-xs uppercase text-muted-foreground">Before</span><p className="whitespace-pre-wrap break-words text-muted-foreground">{change.before}</p></div><div><span className="text-xs uppercase text-muted-foreground">After</span><p className="whitespace-pre-wrap break-words text-[var(--sw-copper,#f3b488)]">{change.after}</p></div></div></article>)}</div>
  </details>;
}
