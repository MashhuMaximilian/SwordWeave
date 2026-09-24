import type { DraftOperation } from "./draft-types";

/** A replacement or selected set is one user action, including after a reload. */
export function popDraftAction(operations: DraftOperation[]) {
  const last = operations.at(-1);
  if (!last) return { remaining: operations, action: [] as DraftOperation[] };
  let index = operations.length - 1;
  if (last.groupId) while (index > 0 && operations[index - 1]?.groupId === last.groupId) index--;
  return { remaining: operations.slice(0, index), action: operations.slice(index) };
}
