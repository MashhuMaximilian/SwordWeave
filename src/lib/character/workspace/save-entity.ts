import type { WorkspaceNode, WorkspaceEdge } from "./model";

/** Adapt canonical junctions to the same payloads the Atelier composers submit.
 * Membership changes save the container, never any referenced child. */
export function containerPayload(
  node: WorkspaceNode,
  edges: readonly WorkspaceEdge[],
): Record<string, unknown> {
  const children = edges
    .filter((e) => e.parent === node.key)
    .sort((a, b) => a.order - b.order);
  const primitiveSlots = children
    .filter((e) => e.child.startsWith("primitive:"))
    .map((e) => ({
      ...e.data,
      primitiveId: Number(e.child.slice(10)),
      role: e.data?.["role"] ?? "OTHER",
      quantity: e.data?.["quantity"] ?? 1,
      isMirrored: e.isMirrored,
    }));
  const effectSlots = children
    .filter((e) => e.child.startsWith("effect:"))
    .map((e) => ({ ...e.data, effectId: e.child.slice(7) }));
  const capabilityIds = children
    .filter((e) => e.child.startsWith("capability:"))
    .map((e) => e.child.slice(11));
  return {
    ...node.data,
    intent: "load",
    primitiveSlots,
    primitiveIds: primitiveSlots.map((p) => p.primitiveId),
    effectSlots,
    effectIds: effectSlots.map((e) => e.effectId),
    capabilityIds,
  };
}

/** Endpoint adapters preserve the existing dispatcher's public behavior. The
 * outer character transaction encompasses nested endpoint transactions and
 * recordVersion calls via request-local DB scope. A failed response rolls back. */
export async function saveWorkspaceEntity(
  node: WorkspaceNode,
  payload: Record<string, unknown>,
) {
  const request = new Request(
    `http://workspace.internal/api/${node.kind}/${node.id}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
  const context = { params: Promise.resolve({ id: node.id }) };
  let response: Response;
  switch (node.kind) {
    case "primitive":
      response = await (
        await import("@/app/api/primitives/route")
      ).POST(
        new Request(request, {
          method: "POST",
          body: JSON.stringify({ ...payload, sourceId: Number(node.id) }),
        }),
      );
      break;
    case "capability":
      response = await (
        await import("@/app/api/capabilities/[id]/route")
      ).PATCH(request, context);
      break;
    case "effect":
      response = await (
        await import("@/app/api/effects/[id]/route")
      ).PATCH(request, context);
      break;
    case "heritage":
      response = await (
        await import("@/app/api/heritage/[id]/route")
      ).PATCH(request, context);
      break;
    case "item":
      response = await (
        await import("@/app/api/items/[id]/route")
      ).PATCH(request, context);
      break;
  }
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error ?? "Unable to save this entity.");
  return {
    id: String(
      result.dispatchOutcome?.newId ??
        result[node.kind]?.id ??
        result.template?.id ??
        node.id,
    ),
    outcome: String(result.dispatchOutcome?.kind ?? "version-update"),
    result,
  };
}

export async function createWorkspaceEntity(
  kind: WorkspaceNode["kind"],
  payload: Record<string, unknown>,
) {
  const request = new Request("http://workspace.internal/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...payload,
      sourceId: undefined,
      id: undefined,
      intent: null,
    }),
  });
  let response: Response;
  switch (kind) {
    case "primitive":
      response = await (
        await import("@/app/api/primitives/route")
      ).POST(request);
      break;
    case "effect":
      response = await (await import("@/app/api/effects/route")).POST(request);
      break;
    case "capability":
      response = await (
        await import("@/app/api/capabilities/route")
      ).POST(request);
      break;
    case "heritage":
      response = await (await import("@/app/api/heritage/route")).POST(request);
      break;
    case "item":
      response = await (await import("@/app/api/items/route")).POST(request);
      break;
  }
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error ?? "Unable to create this piece.");
  const id =
    result.dispatchOutcome?.newId ?? result[kind]?.id ?? result.template?.id;
  if (!id) throw new Error("The save did not return an entity identity.");
  return { id: String(id), result };
}
