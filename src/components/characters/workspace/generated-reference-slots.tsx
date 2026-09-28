import {readFlavorReference} from "@/lib/capabilities/flavor-reference";
import type {GeneratedProposal} from "@/lib/character/workspace/discovery/procedural-generator";
export function GeneratedReferenceSlots({proposal}:{proposal:GeneratedProposal}) {
 const slots=[{label:"Verb tier / verb",category:"VERB_ACCESS",flavor:"verb"},{label:"Domain",category:"DOMAIN_ACCESS",flavor:"domain"},{label:"Range",category:"RANGE_SCALING"},{label:"Output die",category:"INTENSITY_DICE"}] as const;
 return <div className="generated-reference-slots">{slots.map(slot=>{
  const piece=proposal.pieces.find(piece=>piece.seed.familyKey===slot.category);
  const flavor="flavor" in slot ? readFlavorReference(proposal.description,slot.flavor) : "";
  return <div className="generated-reference-slot" key={slot.category}><small>{slot.label}</small><strong>{piece?.seed.name ?? (flavor || "Not included")}</strong><span>{piece ? piece.ownedKey?"Owned access":"Purchased access" : flavor ? "Flavor only" : "Optional"}</span></div>;
 })}</div>;
}
