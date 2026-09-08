import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { characters } from "@/db/schema";
import { readWorkspace } from "@/lib/character/workspace/read";
import { validateDraftReferences } from "@/lib/character/workspace/reference-access";
import { containerPayload } from "@/lib/character/workspace/save-entity";
import { membershipCostChange } from "@/lib/character/workspace/cost-preview";
import {
  bundleBu,
  validateReference,
  type EntityKey,
  type WorkspaceEdge,
  type WorkspaceNode,
} from "@/lib/character/workspace/model";
const schema = z.object({
  kind: z.enum(["primitive", "effect", "capability", "heritage", "item"]),
  category: z.enum(["LINEAGE", "UPBRINGING", "MANIFEST", "ITEM"]),
  expectedRevision: z.number().int(),
  draft: z.record(z.string(), z.unknown()),
  edit: z.boolean(),
  target: z.string().optional(),
});
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await auth.protect();
    const { id } = await params;
    const body = schema.parse(await request.json());
    const character = await db.query.characters.findFirst({
      where: eq(characters.id, id),
    });
    if (!character || character.userId !== userId)
      return NextResponse.json(
        { error: "You do not own this character." },
        { status: 403 },
      );
    let graph = await readWorkspace(id);
    if (graph.revision !== body.expectedRevision)
      return NextResponse.json(
        {
          error:
            "The character changed. Refresh character data before reviewing this draft.",
        },
        { status: 409 },
      );
    const target = graph.nodes.find((node) => node.key === body.target);
    const draft =
      body.edit && target
        ? { ...containerPayload(target, graph.edges), ...body.draft }
        : body.draft;
    await validateDraftReferences(id, userId, draft, graph);
    const refs: { key: EntityKey; data: Record<string, unknown> }[] = [];
    for (const [kind, slots, ids, idField] of [
      ["primitive", "primitiveSlots", "primitiveIds", "primitiveId"],
      ["effect", "effectSlots", "effectIds", "effectId"],
      ["capability", null, "capabilityIds", "capabilityId"],
    ] as const) {
      const values =
        slots && Array.isArray(draft[slots])
          ? (draft[slots] as Record<string, unknown>[])
          : (Array.isArray(draft[ids]) ? (draft[ids] as unknown[]) : []).map(
              (value) => ({ [idField]: value }),
            );
      for (const value of values)
        refs.push({ key: `${kind}:${value[idField]}`, data: value });
    }
    if (refs.length)
      graph = await readWorkspace(
        id,
        refs.map((ref) => ref.key),
      );
    const node: WorkspaceNode =
      body.edit && target
        ? {
            ...target,
            name: String(draft["name"] ?? target.name),
            data: { ...target.data, ...draft },
            bu: Number(draft["buCost"] ?? target.bu),
          }
        : {
            key: `${body.kind}:draft`,
            kind: body.kind,
            id: "draft",
            name: String(draft["name"] ?? "New bundle"),
            description: "",
            bu: Number(draft["buCost"] ?? 0),
            data: draft,
            userId,
            versionId: null,
            latestVersionId: null,
          };
    let edges = graph.edges.filter(
      (edge) => !body.edit || edge.parent !== node.key,
    );
    if (!body.edit)
      edges = [
        ...edges,
        {
          id: "draft-root",
          parent: target?.key ?? null,
          child: node.key,
          category: body.category,
          order: 0,
          isMirrored: false,
        },
      ];
    const after = {
      ...graph,
      nodes: [...graph.nodes.filter((n) => n.key !== node.key), node],
      edges,
    };
    for (const [index, ref] of refs.entries()) {
      const error = validateReference(after, node.key, ref.key);
      if (error) throw new Error(error);
      after.edges.push({
        id: `draft-${index}`,
        parent: node.key,
        child: ref.key,
        category: "ALL",
        order: index,
        isMirrored: Boolean(ref.data["isMirrored"]),
        data: ref.data,
      } satisfies WorkspaceEdge);
    }
    const delta = membershipCostChange(graph, after);
    return NextResponse.json({
      ...delta,
      buSpent: character.buSpent,
      bundleBu: bundleBu(after, node.key),
      members: refs.map(
        (ref) => graph.nodes.find((n) => n.key === ref.key)?.name ?? ref.key,
      ),
      name: node.name,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to preview this draft.",
      },
      { status: 400 },
    );
  }
}
