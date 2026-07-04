import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import {
  primitives,
  templateCapabilities,
  templatePrimitives,
  templates,
} from "@/db/schema";
import { expectedCategoryForKind } from "../route";

/**
 * GET /api/templates/[id]
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const row = await db.query.templates.findFirst({
    where: eq(templates.id, id),
    with: {
      primitiveLinks: { with: { primitive: true } },
      capabilityLinks: { with: { capability: true } },
    },
  });

  if (!row) {
    return NextResponse.json({ error: "Template not found." }, { status: 404 });
  }

  const bu = row.primitiveLinks.reduce(
    (t, l) => t + (l.primitive?.buCost ?? 0),
    0,
  );

  return NextResponse.json({ template: { ...row, computedBu: bu } });
}

/**
 * PATCH /api/templates/[id]
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await auth.protect();
    const { id } = await params;
    const body: unknown = await request.json();

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const values = body as Record<string, unknown>;
    const updatePayload: Record<string, unknown> = {};
    if ("name" in values) updatePayload["name"] = String(values["name"]).trim();
    if ("imageUrl" in values)
      updatePayload["imageUrl"] = String(values["imageUrl"]).trim() || null;
    if ("description" in values)
      updatePayload["description"] = String(values["description"]).trim() || null;
    if ("suggestedTraits" in values)
      updatePayload["suggestedTraits"] =
        String(values["suggestedTraits"]).trim() || null;
    if ("isPublic" in values) updatePayload["isPublic"] = Boolean(values["isPublic"]);

    updatePayload["updatedAt"] = new Date();

    // Get current template for category check
    const current = await db.query.templates.findFirst({
      where: eq(templates.id, id),
    });
    if (!current) {
      return NextResponse.json({ error: "Template not found." }, { status: 404 });
    }

    const result = await db.transaction(async (tx) => {
      if (Object.keys(updatePayload).length > 0) {
        await tx
          .update(templates)
          .set(updatePayload)
          .where(eq(templates.id, id));
      }

      if ("primitiveIds" in values) {
        const primitiveIds = Array.isArray(values["primitiveIds"])
          ? (values["primitiveIds"] as unknown[])
              .map(Number)
              .filter((n) => Number.isInteger(n) && n > 0)
          : [];

        if (primitiveIds.length > 0) {
          const prims = await tx
            .select()
            .from(primitives)
            .where(inArray(primitives.id, primitiveIds));

          const expected = expectedCategoryForKind(current.kind);
          const wrong = prims.filter((p) => p.category !== expected);
          if (wrong.length > 0) {
            throw new Error(
              `${current.kind} templates can only use ${expected} primitives. Invalid: ${wrong.map((p) => p.name).join(", ")}`,
            );
          }

          await tx
            .delete(templatePrimitives)
            .where(eq(templatePrimitives.templateId, id));
          await tx.insert(templatePrimitives).values(
            prims.map((p, idx) => ({
              templateId: id,
              primitiveId: p.id,
              sortOrder: idx,
            })),
          );
        }
      }

      if ("capabilityIds" in values) {
        const capabilityIds = Array.isArray(values["capabilityIds"])
          ? (values["capabilityIds"] as unknown[]).filter(
              (c) => typeof c === "string",
            )
          : [];

        await tx
          .delete(templateCapabilities)
          .where(eq(templateCapabilities.templateId, id));
        if (capabilityIds.length > 0) {
          await tx.insert(templateCapabilities).values(
            capabilityIds.map((cid) => ({
              templateId: id,
              capabilityId: cid as string,
            })),
          );
        }
      }

      return tx.query.templates.findFirst({
        where: eq(templates.id, id),
        with: {
          primitiveLinks: { with: { primitive: true } },
          capabilityLinks: { with: { capability: true } },
        },
      });
    });

    return NextResponse.json({ template: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

/**
 * DELETE /api/templates/[id]
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await auth.protect();
    const { id } = await params;

    const [deleted] = await db
      .delete(templates)
      .where(eq(templates.id, id))
      .returning({ id: templates.id });

    if (!deleted) {
      return NextResponse.json({ error: "Template not found." }, { status: 404 });
    }

    return NextResponse.json({ deleted: deleted.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}