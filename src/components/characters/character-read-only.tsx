"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { WorkspaceGraph } from "@/lib/character/workspace/model";
import type { RuntimeCondition } from "@/lib/hooks/use-runtime-conditions";

const emptyConditions: readonly RuntimeCondition[] = [];
const context = createContext<{ readOnly: boolean; conditions: readonly RuntimeCondition[]; graph: WorkspaceGraph | null }>({ readOnly: false, conditions: emptyConditions, graph: null });

/** A viewing session never imports or writes the owner's browser play cache. */
export function CharacterReadOnlyProvider({ readOnly, conditions = emptyConditions, graph = null, children }: {
  graph?: WorkspaceGraph | null | undefined;
  readOnly: boolean; conditions?: readonly RuntimeCondition[] | undefined; children: ReactNode;
}) {
  return <context.Provider value={{ readOnly, conditions, graph }}>{children}</context.Provider>;
}
export function useCharacterReadOnly() { return useContext(context).readOnly; }
export function useReadOnlyConditions() { return useContext(context).conditions; }

export function useReadOnlyGraph() { return useContext(context).graph; }
