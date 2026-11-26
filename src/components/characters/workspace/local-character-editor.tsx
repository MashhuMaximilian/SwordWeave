"use client";

import type { ReactNode } from "react";
import { Plus, ChevronRight, UserRound, SlidersHorizontal, BookOpen } from "lucide-react";
import { EntityTypeIcon } from "@/components/icons/entity-type-icon";
import type { WorkspaceCategory, EntityKind } from "@/lib/character/workspace/model";
import "./local-character-editor.css";

type Group = { key: Exclude<WorkspaceCategory,"ALL">; name: string; count: number; children: ReactNode };

/** A small extension of the incumbent workshop, using its real piece rows and forms. */
export function LocalCharacterOverview({ name, level, size, attributes, groups, onFoundation, onRoot, onNew }: {
  name: string; level: number; size: string; attributes: string; groups: Group[];
  onFoundation: (section: "concept"|"foundation"|"backstory") => void;
  onRoot: (root: WorkspaceCategory) => void;
  onNew: (root: Exclude<WorkspaceCategory,"ALL">, kind: EntityKind) => void;
}) {
  return <div className="sw-edit-index">
    <header><h3>{name}</h3><p>Level {level} · {size.toLowerCase()} · {attributes}</p><nav aria-label="Edit character details">
      <button type="button" onClick={()=>onFoundation("concept")}><UserRound size={13}/> Identity</button>
      <button type="button" onClick={()=>onFoundation("foundation")}><SlidersHorizontal size={13}/> Body & budget</button>
      <button type="button" onClick={()=>onFoundation("backstory")}><BookOpen size={13}/> Story</button>
    </nav></header>
    <p className="sw-edit-index-hint">Choose a piece to edit it. Preview reads its rules; Review checks your draft before saving.</p>
    {groups.map(group=><section className="sw-edit-group" key={group.key}>
      <header><button type="button" onClick={()=>onRoot(group.key)}><EntityTypeIcon type={group.key} size={22}/><strong>{group.name}</strong><small>{group.count}</small><ChevronRight size={12}/></button>
        <details className="sw-edit-add-menu"><summary><Plus size={12}/> Add</summary><div>{(group.key==="ITEM"?["item"]:["heritage","capability","effect","primitive"] as EntityKind[]).map(kind=><button type="button" key={kind} onClick={()=>onNew(group.key,kind as EntityKind)}>New {kind}</button>)}</div></details>
      </header>
      {group.count ? group.children : <p className="sw-edit-group-empty">No {group.key==="ITEM"?"items":"pieces"} yet.</p>}
    </section>)}
  </div>;
}
