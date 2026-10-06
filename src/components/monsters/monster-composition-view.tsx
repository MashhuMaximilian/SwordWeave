"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { CompositionTree, EntityPreview, type CompositionNode } from "@/components/preview/entity-preview";
import { CompactHierarchyBranch } from "@/components/characters/compact-hierarchy";
import { InstrumentDialogFrame } from "@/components/ui/instrument-dialog";
import type { SandboxPreviewItem } from "@/components/library/library-item-preview";
import type { MonsterComponentPin } from "@/lib/monsters/composition";
import type { MonsterReference } from "@/lib/monsters/model";
import type { PinnedDefinition } from "@/lib/monsters/service";
import type { MonsterSlot } from "@/lib/monsters/resolve";
import { mechanicalDescriptionFromModifiers } from "@/lib/primitives/mechanical-rule";
import { mirrorConsequence } from "@/lib/character/mirror-suggestions";
import { mapPayloadToPreviewItem } from "@/components/library/version-preview-button";
import { loadMonsterComponentPreview } from "./monster-component-preview";
import "./monster-template-preview.css";

type Branch = { pin: MonsterComponentPin; reference: MonsterReference; children: Branch[]; slot?: MonsterSlot; truncated?: boolean };
/** Follow recorded edges only. A missing or ambiguous saved version never selects today's row. */
export function monsterCompositionBranches(definition: PinnedDefinition, slots: MonsterSlot[]): Branch[] {
  const pins = definition.componentPins ?? [];
  let remaining = 5000;
  function walk(reference: MonsterReference, ancestors: string[] = []): Branch | null {
    if (--remaining < 0) return null;
    const matches = pins.filter(pin => pin.kind === reference.kind.toLowerCase() && pin.id === reference.id && (reference.versionId ? pin.versionId === reference.versionId : true));
    const pin = matches.length === 1 ? matches[0] : matches.find(pin => pin.versionId === null);
    if (!pin) return null;
    const truncated = ancestors.includes(pin.key) || ancestors.length >= 24;
    const path = [...ancestors, pin.key];
    const slot = pin.kind === "primitive" ? slots.find(slot => slot.primitiveId === Number(pin.id) && slot.isMirrored === reference.isMirrored && slot.dependencyVersions?.includes(pin.key)) : undefined;
    return { pin, reference, ...(slot ? { slot } : {}), ...(truncated ? { truncated: true } : {}), children: truncated ? [] : pin.links.flatMap(link => {
      const versionId = "versionId" in link ? link.versionId : link.data["versionId"];
      const child = walk({ kind: link.kind.toUpperCase() as MonsterReference["kind"], id: String(link.id), versionId: typeof versionId === "string" ? versionId : null, quantity: reference.quantity * Number(link.data["quantity"] ?? 1), isMirrored: reference.isMirrored !== (link.data["isMirrored"] === true) }, path);
      return child ? [child] : [];
    }) };
  }
  return definition.references.flatMap(reference => { const branch = walk(reference); return branch ? [branch] : []; });
}

export function MonsterCompositionView({ definition, slots, renderActions, onActions, filterKinds, isActive }: {
  definition: PinnedDefinition;
  slots: MonsterSlot[];
  renderActions?: (pin: MonsterComponentPin) => ReactNode;
  onActions?: (pin: MonsterComponentPin) => ReactNode;
  filterKinds?: readonly (MonsterReference["kind"] | MonsterComponentPin["kind"])[];
  isActive?: (pin: MonsterComponentPin) => boolean;
}) {
  const [preview, setPreview] = useState<MonsterComponentPin | null>(null);
  const branches = monsterCompositionBranches(definition, slots).filter(branch => !filterKinds || filterKinds.some(kind => kind.toLowerCase() === branch.pin.kind));
  const lookup = new Map<string, MonsterComponentPin>();
  function node(branch: Branch, path: string): CompositionNode {
    const { pin, reference, slot } = branch;
    const id = `${path}/${pin.key}`;
    lookup.set(id, pin);
    const fallback = pin.fallback ?? {};
    const prose = [fallback["mechanicalOutputText"], fallback["narrativeRule"], fallback["description"], fallback["verboseDescription"]].find(value => typeof value === "string" && value.trim()) as string | undefined;
    const cost = slot ? Math.abs(slot.buCost * reference.quantity) : slots.filter(slot => slot.dependencyVersions?.includes(pin.key)).reduce((total, slot) => total + Math.abs(slot.buCost * slot.quantity), 0);
    return { id, name: pin.name, kind: pin.kind === "heritage" ? "capability" : pin.kind, targetType: pin.kind === "heritage" ? "CAPABILITY" : pin.kind.toUpperCase() as CompositionNode["targetType"], bu: cost,
      note: slot && reference.isMirrored ? [mirrorConsequence({id:slot.primitiveId,buCost:slot.buCost,mirrorVector:slot.mirrorVector,hardModifiers:slot.hardModifiers}), prose ? "Original rule: " + prose : mechanicalDescriptionFromModifiers(slot.hardModifiers)].filter(Boolean).join(" ") : prose || (slot ? mechanicalDescriptionFromModifiers(slot.hardModifiers) : null), noteRole: slot ? "mechanical" : "narrative",
      meta: <>×{reference.quantity}{reference.isMirrored ? " · Mirrored" : ""} · {pin.versionId ? "Saved version" : "Saved unpublished snapshot"}{isActive && !isActive(pin) ? " · Disabled" : ""}{branch.truncated ? " · Further nesting unavailable" : branch.children.length < pin.links.length ? " · Some saved pieces unavailable" : ""}</>,
      actions: (renderActions ?? onActions)?.(pin), children: branch.children.map((child, index) => node(child, `${id}:${index}`)) };
  }
  const onSubLink = (link: {targetId: string}) => { const pin = lookup.get(link.targetId); if (pin) setPreview(pin); };
  return <div className="sw-monster-composition v12-composite-preview-secondary">
    {branches.length ? <>
      {branches.filter(branch => branch.pin.kind === "heritage").map((branch, index) => <CompactHierarchyBranch key={`${branch.pin.key}:${index}`} label={branch.pin.name} count={branch.children.length} tone="gold" defaultExpanded>
        <button type="button" className="v12-metal-button" onClick={() => setPreview(branch.pin)}>Preview heritage · {branch.pin.versionId ? "saved version" : "snapshot"} · ×{branch.reference.quantity}{branch.reference.isMirrored ? " · Mirrored" : ""}</button>
        {(renderActions ?? onActions)?.(branch.pin)}
        <CompositionTree title="Included abilities" nodes={branch.children.map((child, childIndex) => node(child, `heritage:${index}:${childIndex}`))} onSubLink={onSubLink}/>
      </CompactHierarchyBranch>)}
      {(["capability", "effect", "primitive", "item"] as const).map(kind => <CompositionTree key={kind} title={kind === "item" ? "Equipment" : kind === "primitive" ? "Direct primitives" : kind === "effect" ? "Effects" : "Capabilities"} nodes={branches.filter(branch => branch.pin.kind === kind).map((branch, index) => node(branch, `${kind}:${index}`))} onSubLink={onSubLink}/>)}
    </> : <p>No saved components in this section.</p>}
    {definition.references.filter(reference => !filterKinds || filterKinds.some(kind => kind.toLowerCase() === reference.kind.toLowerCase())).length > branches.length && <p role="status">Some saved components are unavailable. Their current Library versions have not been substituted.</p>}
    {preview && <PinnedCompositionDialog key={preview.key} pin={preview} pins={definition.componentPins ?? []} onClose={() => setPreview(null)} onOpen={setPreview}/>}
  </div>;
}

function PinnedCompositionDialog({pin, pins, onClose, onOpen}: {pin: MonsterComponentPin; pins: MonsterComponentPin[]; onClose: () => void; onOpen: (pin: MonsterComponentPin) => void}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [item, setItem] = useState<SandboxPreviewItem | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    dialog.current?.showModal();
    const controller = new AbortController();
    // Unpublished records use the captured payload rather than an evolving Library row.
    const names = Object.fromEntries(pins.map(pin => [`${pin.kind}:${pin.id}`, pin.name]));
    const captured = !pin.versionId && pin.fallback ? mapPayloadToPreviewItem(pin.kind.toUpperCase(), pin.id, pin.fallback, names) : null;
    const request = !pin.versionId ? (captured ? Promise.resolve(captured) : Promise.reject(new Error("This unpublished component has no published version to preview. Its saved rules remain in the composition cards."))) : loadMonsterComponentPreview({kind: pin.kind.toUpperCase() as MonsterReference["kind"], id: pin.id, versionId: pin.versionId}, controller.signal, names);
    void request.then(value => { if (!controller.signal.aborted) setItem(value); }).catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Unable to open the saved component."); });
    return () => controller.abort();
  }, [pin, pins]);
  return <dialog ref={dialog} className="sw-monster-component-dialog" onCancel={event => {event.preventDefault(); onClose();}}>
    <InstrumentDialogFrame title={pin.name} kicker="Saved component" onClose={onClose}>
      {error ? <p role="alert">{error}</p> : item ? <EntityPreview item={item} callbacks={{preferLocalSubLinks:true,onSubLinkClick:link => {
        const edge = pin.links.find(edge => String(edge.id) === link.targetId && edge.kind === link.targetType.toLowerCase());
        const version = edge ? ("versionId" in edge ? edge.versionId : edge.data["versionId"]) : null;
        const matches = pins.filter(child => child.kind === link.targetType.toLowerCase() && child.id === link.targetId && (typeof version === "string" ? child.versionId === version : true));
        if(matches.length === 1) onOpen(matches[0]!); else setError("That component's saved version is unavailable.");
      }}}/> : <p role="status">Opening saved component…</p>}
    </InstrumentDialogFrame>
  </dialog>;
}
