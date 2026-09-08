import { supplyPaths, type WorkspaceGraph } from "./model";
/** Predict canonical materialization: the first inherited supply can reuse an
 * existing direct instance; additional explicit purchases keep their cost. */
export function membershipCostChange(
  before: WorkspaceGraph,
  after: WorkspaceGraph,
) {
  let characterBuDelta = 0,
    mirrorCreditDelta = 0;
  const keys = new Set(
    [...before.nodes, ...after.nodes]
      .filter((n) => n.kind === "primitive")
      .map((n) => n.key),
  );
  const changes: { name: string; before: number; after: number }[] = [];
  for (const key of keys) {
    const oldNode = before.nodes.find((n) => n.key === key),
      newNode = after.nodes.find((n) => n.key === key);
    const node = newNode ?? oldNode!;
    const oldPaths = supplyPaths(before, key).filter((p) => !p.item),
      newPaths = supplyPaths(after, key).filter((p) => !p.item);
    function instances(paths: typeof oldPaths, mirrored: boolean) {
      const matching = paths.filter(
        (p) => p.edges.some((e) => e.isMirrored) === mirrored,
      );
      const inherited = matching.some((p) => p.nodes.length > 1);
      const direct = matching.filter((p) => p.nodes.length === 1);
      return {
        inherited,
        direct: direct.length,
        count:
          direct.filter(
            (p) => !inherited || !p.edges[0]?.data?.["directSource"],
          ).length + Number(inherited),
      };
    }
    for (const mirrored of [false, true]) {
      const old = instances(oldPaths, mirrored),
        next = instances(newPaths, mirrored);
      // Unmirrored direct rows are adopted by the first bundle supply.
      const nextCount =
        next.count -
        Number(
          !mirrored &&
            !old.inherited &&
            next.inherited &&
            old.direct > 0 &&
            next.direct > 0,
        );
      if (mirrored) {
        if (node.data["isMirrorable"])
          mirrorCreditDelta +=
            nextCount *
              Number(newNode?.data["mirrorBuCredit"] ?? newNode?.bu ?? 0) -
            old.count *
              Number(oldNode?.data["mirrorBuCredit"] ?? oldNode?.bu ?? 0);
      } else
        characterBuDelta +=
          nextCount * (newNode?.bu ?? 0) - old.count * (oldNode?.bu ?? 0);
    }
    if (oldPaths.length !== newPaths.length)
      changes.push({
        name: node.name,
        before: oldPaths.length,
        after: newPaths.length,
      });
  }
  return { characterBuDelta, mirrorCreditDelta, changes };
}
