import {readTableGuidance,TABLE_AXES,type TableAxis} from "@/lib/capabilities/table-guidance";
import {readRollResolution} from "@/lib/capabilities/roll-resolution";
import {GeneratedReferenceSlots} from "./generated-reference-slots";
import type {GeneratedProposal} from "@/lib/character/workspace/discovery/procedural-generator";
const referenceFamilies=["DOMAIN_ACCESS","VERB_ACCESS","RANGE_SCALING","INTENSITY_DICE"];
export function generatedPieceSummary(proposal:GeneratedProposal){
 const references=proposal.kind==="capability"?proposal.pieces.filter(p=>referenceFamilies.includes(p.seed.familyKey)).length:0;
 return proposal.kind==="capability"?`${proposal.pieces.length-references+(proposal.libraryPieces?.length??0)} additional · ${references} reference rules`:`${proposal.pieces.length+(proposal.libraryPieces?.length??0)} pieces`;
}
export function GeneratedIdeaPreview({proposal}:{proposal:GeneratedProposal}){
 const guidance=readTableGuidance(proposal.description),{resolution}=readRollResolution(guidance.description);
 const regular=proposal.kind==="capability"?proposal.pieces.filter(p=>!referenceFamilies.includes(p.seed.familyKey)):proposal.pieces;
 return <div className="generated-idea-preview">
 {proposal.kind==="capability" && <GeneratedReferenceSlots proposal={proposal}/>}
 {proposal.kind==="capability" && guidance.table && <section><h4>Scaling · suggested intent</h4><dl className="generated-scaling">{Object.entries(TABLE_AXES).map(([key,axis])=><div key={key}><dt>{axis.label}</dt><dd>{guidance.table![key as TableAxis]}</dd></div>)}</dl></section>}
 {resolution.mode!=="unspecified" && <section className="generated-resolution"><h4>Who rolls?</h4><p>{resolution.mode==="automatic"?"No roll":resolution.mode==="action"?"I roll":resolution.mode==="opposed"?"Opposed checks":"Target rolls"}{resolution.check?` · ${resolution.check}`:""}{resolution.dc?` vs ${resolution.dc}`:""}</p>{resolution.outcome && <p>{resolution.outcome}</p>}</section>}
 {!!regular.length && <section><h4>{proposal.kind==="capability"?"Additional primitives":"Mechanical rules"}</h4><ul className="generated-mechanics">{regular.map(piece=><li key={piece.seed.key}><span data-copy="mechanical">{piece.seed.mechanicalOutputText}</span><small>{piece.ownedKey?"Owned":`${piece.seed.buCost} BU`}</small></li>)}</ul></section>}
 {!!proposal.libraryPieces?.length && <section><h4>Additional pieces</h4><ul className="generated-mechanics">{proposal.libraryPieces.map(piece=><li key={piece.key}><span><strong>{piece.name}</strong><small><b className="generated-piece-kind">{piece.kind}</b> · {piece.mechanicalDescription}</small></span><small>{piece.cost} BU definition</small></li>)}</ul></section>}
 </div>;
}
