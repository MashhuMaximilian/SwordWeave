import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { characters } from "@/db/schema";
import { workspaceCommandSchema } from "@/lib/character/workspace/commands";
import { readWorkspace } from "@/lib/character/workspace/read";
import {
  validateReference,
  type EntityKey,
  type WorkspaceEdge,
} from "@/lib/character/workspace/model";
import { membershipCostChange } from "@/lib/character/workspace/cost-preview";
import { visibilityCondition } from "@/lib/publishing/library-query";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth.protect();
  const { id } = await params;
  try {
    const command = workspaceCommandSchema.parse(await request.json());
    const character = await db.query.characters.findFirst({
      where: eq(characters.id, id),
    });
    if (!character || character.userId !== userId)
      return NextResponse.json(
        { error: "You do not own this character." },
        { status: 403 },
      );
    const graph = await readWorkspace(
      id,
      command.child ? [command.child as EntityKey] : [],
    );
    if (graph.revision !== command.expectedRevision)
      return NextResponse.json(
        { error: "The character changed. Refresh the preview." },
        { status: 409 },
      );
    const target = graph.nodes.find((n) => n.key === command.target);
    if (!target) throw new Error("Choose a destination.");
    let edges = graph.edges;
    if (command.operation === "add-reference") {
      const child = graph.nodes.find((n) => n.key === command.child);
      if (!child) throw new Error("Choose a piece.");
      if (!graph.edges.some((e) => e.child === child.key)) {
        const type =
          child.kind === "heritage"
            ? `${child.data["kind"]}_TEMPLATE`
            : child.kind.toUpperCase();
        const access = await db.execute(
          sql`select ${visibilityCondition(type, sql`${child.id}`, sql`${child.userId}`, userId)} as allowed`,
        );
        if (!access.rows[0]?.["allowed"])
          throw new Error("This piece is private.");
      }
      const error = validateReference(graph, target.key, child.key);
      if (error) throw new Error(error);
      if (!edges.some((e) => e.parent === target.key && e.child === child.key))
        edges = [
          ...edges,
          {
            id: "preview",
            parent: target.key,
            child: child.key,
            category: "ALL",
            order: 0,
            isMirrored: false,
          },
        ];
    } else if (
      command.operation === "remove-reference" ||
      command.operation === "move-reference"
    ) {
      const edge = edges.find(
        (e) => e.id === command.edgeId && e.parent === target.key,
      );
      if (!edge) throw new Error("This membership changed.");
      edges = edges.filter((e) => e.id !== edge.id);
      if (command.operation === "move-reference") {
        const error = validateReference(
          graph,
          command.destination as EntityKey,
          edge.child,
        );
        if (error) throw new Error(error);
        if (
          !edges.some(
            (e) => e.parent === command.destination && e.child === edge.child,
          )
        )
          edges = [
            ...edges,
            {
              ...edge,
              id: "preview",
              parent: command.destination as EntityKey,
            } satisfies WorkspaceEdge,
          ];
      }
    } else if (command.operation === "detach") {
      const root = edges.find(
        (e) =>
          e.id === command.path[0] &&
          e.parent === null &&
          e.child === target.key,
      );
      if (!root) throw new Error("Choose a direct character membership.");
      edges = edges.filter((e) => e.id !== root.id);
    } else
      throw new Error(
        "This preview supports add, remove, and move membership.",
      );
    return NextResponse.json({
      ...membershipCostChange(graph, { ...graph, edges }),
      buSpent: character.buSpent,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Preview unavailable.",
      },
      { status: 400 },
    );
  }
}
