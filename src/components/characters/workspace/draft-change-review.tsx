"use client";
import { Markdown } from "@/components/ui/markdown";
import { draftReviewChanges, type ReviewChange, type ReviewPreview, type ReviewPieceChange } from "./draft-change-review-model";

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
  const changedRows=rows.filter((row,index)=>(!preview.local || index<3) && row[1]!==row[2]);
  return <section className="my-4 space-y-3" aria-label="Draft change review">
    <h3 className="font-semibold text-[var(--sw-gold,#e6c778)]">What changes</h3>
    {preview.local && <p className="text-sm text-muted-foreground">Local budget estimate. Check the draft to calculate all combat statistics and validate the final build.</p>}
    {changedRows.length ? <table className="w-full text-left text-sm"><caption className="sr-only">Changed character totals</caption><thead><tr><th scope="col">Result</th><th scope="col">Before</th><th scope="col">After</th></tr></thead><tbody>{changedRows.map(([label,old,next])=><tr key={label} className="border-t border-border"><th scope="row" className="py-1 font-normal">{label}</th><td>{old}</td><td>{next}</td></tr>)}</tbody></table> : <p className="text-sm text-muted-foreground">{preview.local ? "Complete character totals will be calculated when you check the draft." : "Character totals are unchanged."}</p>}
    <ChangeGroup title="Character details" changes={changes.foundation}/>
    <PieceChanges changes={changes.pieces}/>
    {changes.hasBeforeGraph && !changes.pieces.length && !changes.foundation.length && <p className="text-sm text-muted-foreground">No net build changes. Edits that were reversed cancel out.</p>}
    {!changes.hasBeforeGraph && <p className="text-sm text-muted-foreground">Refresh the preview to compare individual pieces and their placement.</p>}
    {changes.sources.length>0 && <p className="text-xs text-muted-foreground">Source comparison reflects build placement and equipment. Temporary restrictions and local play toggles can still affect live availability.</p>}
    {preview.warnings?.map((warning,index)=><p className="text-sm text-amber-200" key={index}>{warning}</p>)}
  </section>;
}
function ChangeGroup({title,changes}: {title:string;changes:ReviewChange[]}) {
  if (!changes.length) return null;
  return <details className="rounded-md border border-border p-3" open={changes.length<=3}>
    <summary className="cursor-pointer text-sm font-semibold">{title} · {changes.length}</summary>
    <div className="mt-2 space-y-2">{changes.map(change=><article key={change.key} className="border-t border-border pt-2 text-sm"><h4 className="font-semibold">{change.title}</h4><div className="mt-1 grid gap-2 md:grid-cols-2"><div><span className="text-xs uppercase text-muted-foreground">Before</span><ChangeValue value={change.before} markdown={change.format === "markdown"}/></div><div><span className="text-xs uppercase text-muted-foreground">After</span><ChangeValue value={change.after} markdown={change.format === "markdown"}/></div></div></article>)}</div>
  </details>;
}

function ChangeValue({value,markdown=false}: {value:string;markdown?:boolean}) {
  return markdown ? <Markdown className="break-words text-sm">{value}</Markdown> : <p className="whitespace-pre-wrap break-words">{value}</p>;
}
function PieceChanges({changes}: {changes:ReviewPieceChange[]}) {
  if (!changes.length) return null;
  return <section className="space-y-2" aria-label="Changed pieces">
    <h4 className="text-sm font-semibold">Changed pieces · {changes.length}</h4>
    {changes.map(piece => <details key={piece.key} className="rounded-md border border-border p-3" open={changes.length <= 3}>
      <summary className="cursor-pointer text-sm font-semibold">{piece.title}<span className="ml-2 text-xs font-normal text-[var(--sw-gold,#e6c778)]">{piece.status}</span></summary>
      <div className="mt-2 space-y-3">{piece.facets.map(facet => <section key={facet.label} className="border-t border-border pt-2 text-sm">
        <h5 className="text-xs font-semibold uppercase text-muted-foreground">{facet.label}</h5>
        <div className="mt-1 grid gap-2 md:grid-cols-2">
          <div className="min-w-0 text-muted-foreground"><span className="text-xs uppercase">Before</span><ChangeValue value={facet.before}/></div>
          <div className="min-w-0 text-[var(--sw-copper,#f3b488)]"><span className="text-xs uppercase">After</span><ChangeValue value={facet.after}/></div>
        </div>
      </section>)}</div>
    </details>)}
  </section>;
}
