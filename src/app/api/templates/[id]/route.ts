import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { eq, inArray, and, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  primitives,
  templateCapabilities,
  templatePrimitives,
  templates,
} from "@/db/schema";
// Mashu 2026-07-09: expectedCategoryForKind import removed — the
// category restriction is gone.
import {
  dispatchEntitySave,
  type SaveTargetType,
} from "@/lib/publishing/dispatch-save";
import { parseSaveIntent } from "@/lib/publishing/save-intent";
import { computeUniqueForkName } from "@/lib/publishing/fork-naming";
import {
  buildCanonicalTemplatePayload,
  isTemplateDraftEmpty,
  computeTemplateContentHash,
} from "@/lib/publishing/hash-content";
import { recordVersion } from "@/lib/versions/auto-snapshot";

const TARGET_TYPE: SaveTargetType = "TEMPLATE";

type TemplateKind = "RACE" | "BACKGROUND" | "ARCHETYPE";

const VALID_KINDS: TemplateKind[] = ["RACE", "BACKGROUND", "ARCHETYPE"];

function parseKind(value: unknown): TemplateKind | null {
  if (typeof value !== "string") return null;
  const upper = value.toUpperCase();
  if ((VALID_KINDS as string[]).includes(upper)) {
    return upper as TemplateKind;
  }
  return null;
}

/**
 * Phase 2: build a sync-existence predicate for the (name, userId, kind)
 * triple the new fork row will use. Templates have a unique constraint
 * on (name, user_id, kind) — different shape than effects/capabilities/items
 * which use (name, source_origin).
 *
 * Mashu 2026-07-09: predicate now preloads the FULL set of existing fork
 * names for this (userId, kind) pair, not just rows matching the form's
 * `name` field exactly. The previous version queried for `name = $name`
 * and returned false when checking `nameExists("Star-Touched (fork)")`,
 * so `computeUniqueForkName` returned a candidate that collided with an
 * existing fork of the same source — the INSERT then failed with a
 * unique-constraint violation (no error message bubbled to the user).
 *
 * The predicate must return true for ANY candidate that would clash,
 * including `"X (fork)"`, `"X (fork) 2"`, `"X (fork) 3"`, ... We preload
 * the prefix-matched set in one query so the predicate is accurate for
 * every candidate `computeUniqueForkName` will probe.
 */
async function buildTemplateTakenNamesSet(
  name: string,
  kind: TemplateKind,
  userId: string,
): Promise<(candidate: string) => boolean> {
  const forkPrefix = `${name} (fork)`;
  // Match `name (fork)`, `name (fork) 2`, `name (fork) 3`, ... The
  // computeUniqueForkName walker only produces these three shapes, so a
  // prefix LIKE is sufficient.
  const rows = await db
    .select({ name: templates.name })
    .from(templates)
    .where(
      and(
        eq(templates.kind, kind),
        eq(templates.userId, userId),
        // Drizzle doesn't have a `startsWith` helper; use sql template
        // for the LIKE pattern. Anchor the prefix so "Star" doesn't match
        // "Stardust (fork)".
        sql`${templates.name} LIKE ${forkPrefix + "%"}`,
      ),
    );
  const taken = new Set(rows.map((r) => r.name));
  return (candidate: string) => taken.has(candidate);
}

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
 * PATCH /api/templates/[id] — Phase 2 deferred-fork entry point.
 *
 * Same shape as /api/effects/[id] PATCH:
 *   - intent=load + caller owns source → UPDATE in place (version-update)
 *   - intent=fork (any ownership) → INSERT new fork row
 *   - load + caller doesn't own → INSERT new fork row
 *   - no-changes (contentHash matches) → no-op, return user-facing message
 *
 * The (name, user_id, kind) unique constraint is what makes fork-naming
 * tricky for templates. The fork predicate filters by name + kind +
 * userId (not name + sourceOrigin like the other entities).
 *
 * Response shape:
 *   { template, dispatchOutcome: { kind, newId, sourceId, swapTarget } | { kind: "no-op", message } }
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await auth.protect();
    const { id } = await params;
    const body: unknown = await request.json();

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const values = body as Record<string, unknown>;

    // Phase 2: parse intent. Default to "load" (legacy in-place edit
    // behaviour). Forms that fork will send `intent: "fork"`.
    const intent = parseSaveIntent(
      typeof values["intent"] === "string" ? (values["intent"] as string) : undefined,
    );
    const effectiveIntent = intent ?? "load";

    // Need the current row first so we know the kind (the kind is part of
    // the canonical hash envelope). The form re-sends kind for safety,
    // but we treat the existing row's kind as authoritative — the form
    // can't switch a row between RACE / BACKGROUND / ARCHETYPE via PATCH.
    const current = await db.query.templates.findFirst({
      where: eq(templates.id, id),
    });
    if (!current) {
      return NextResponse.json({ error: "Template not found." }, { status: 404 });
    }

    // -------------------------------------------------------------------
    // Field parsing — preserve existing behaviour from the legacy PATCH.
    // -------------------------------------------------------------------
    const name = String(values["name"] ?? "").trim();
    const imageUrl =
      "imageUrl" in values
        ? String(values["imageUrl"]).trim() || null
        : current.imageUrl;
    const description =
      "description" in values
        ? String(values["description"]).trim() || null
        : current.description;
    const suggestedTraits =
      "suggestedTraits" in values
        ? String(values["suggestedTraits"]).trim() || null
        : current.suggestedTraits;
    const isPublic = "isPublic" in values
      ? Boolean(values["isPublic"])
      : current.isPublic;

    const primitiveIds = Array.isArray(values["primitiveIds"])
      ? (values["primitiveIds"] as unknown[])
          .map(Number)
          .filter((n) => Number.isInteger(n) && n > 0)
      : [];
    const capabilityIds = Array.isArray(values["capabilityIds"])
      ? (values["capabilityIds"] as unknown[]).filter(
          (c) => typeof c === "string",
        )
      : [];

    if (!name) {
      return NextResponse.json({ error: "Template name is required." }, { status: 400 });
    }

    // -------------------------------------------------------------------
    // Canonical payload + content hash (server is the source of truth).
    // kind comes from the existing row — it's the row's identity, not a
    // patchable field.
    // -------------------------------------------------------------------
    const kind: TemplateKind = current.kind;
    const canonicalPayload = buildCanonicalTemplatePayload({
      kind,
      name,
      description: description ?? "",
      suggestedTraits: suggestedTraits ?? "",
      isPublic,
      primitiveIds,
      capabilityIds: capabilityIds as string[],
    });
    const draftIsEmpty = isTemplateDraftEmpty(canonicalPayload);
    const draftHash = await computeTemplateContentHash({
      kind,
      name,
      description: description ?? "",
      suggestedTraits: suggestedTraits ?? "",
      isPublic,
      primitiveIds,
      capabilityIds: capabilityIds as string[],
    });

    // -------------------------------------------------------------------
    // Dispatcher.
    // -------------------------------------------------------------------
    const { source, outcome } = await dispatchEntitySave({
      targetType: TARGET_TYPE,
      sourceId: id,
      intent: effectiveIntent,
      callerUserId: userId,
      draftHash,
      draftIsEmpty,
    });

    // No-op short-circuit.
    if (outcome.kind === "no-op") {
      return NextResponse.json(
        {
          template: null,
          dispatchOutcome: {
            kind: "no-op" as const,
            message: outcome.message,
            swapTarget: false as const,
          },
        },
        { status: 200 },
      );
    }

    if (outcome.kind === "version-update") {
      const updatePayload: Record<string, unknown> = {
        name,
        imageUrl,
        description,
        suggestedTraits,
        isPublic,
        sourceOrigin: current.sourceOrigin, // preserve
        contentHash: draftHash,
        updatedAt: new Date(),
      };

      const result = await db.transaction(async (tx) => {
        await tx
          .update(templates)
          .set(updatePayload)
          .where(
            and(
              eq(templates.id, id),
              or(eq(templates.userId, userId), isNull(templates.userId)),
            ),
          );

        // Replace primitive slot links with the new set.
        // Mashu 2026-07-09: category restriction removed — templates
        // can slot any primitive. The previous HERITAGE_AUGMENT
        // filter is gone; designers decide what makes sense for the
        // race/background/archetype they're composing.
        if ("primitiveIds" in values && primitiveIds.length > 0) {
          const prims = await tx
            .select()
            .from(primitives)
            .where(inArray(primitives.id, primitiveIds));

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

        // Replace capability slot links.
        if ("capabilityIds" in values) {
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

      // Phase 4: auto-snapshot the updated template.
      if (result) {
        await recordVersion({
          entityKind: "template",
          entityId: id,
          contentHash: draftHash,
          snapshot: canonicalPayload as unknown as Record<string, unknown>,
          publishedByUserId: userId,
        });
      }

      if (result) {
        const bu = result.primitiveLinks.reduce(
          (t, l) => t + (l.primitive?.buCost ?? 0),
          0,
        );
        return NextResponse.json(
          {
            template: { ...result, computedBu: bu },
            dispatchOutcome: {
              kind: "version-update" as const,
              newId: id,
              sourceId: outcome.sourceId,
              swapTarget: false as const,
            },
          },
          { status: 200 },
        );
      }
      throw new Error("Template not found after update.");
    }

    // outcome.kind === "forked" — INSERT a new row.
    // sourceOrigin for the fork: "fork:<sourceId>" for non-greenfield.
    // (PATCH is always non-greenfield — the route has a URL param.)
    const finalSourceOrigin = `fork:${source !== null ? source.id : id}`;

    const baseName = await computeUniqueForkName(
      name,
      await buildTemplateTakenNamesSet(name, kind, userId),
    );

    const created = await db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(templates)
        .values({
          kind,
          name: baseName,
          imageUrl,
          description,
          suggestedTraits,
          isPublic,
          userId,
          sourceOrigin: finalSourceOrigin,
          contentHash: draftHash,
        })
        .returning();

      if (!inserted) {
        throw new Error("Unable to create template.");
      }

      // Validate + insert primitive slots.
      // Mashu 2026-07-09: category restriction removed.
      if (primitiveIds.length > 0) {
        const prims = await tx
          .select()
          .from(primitives)
          .where(inArray(primitives.id, primitiveIds));

        await tx.insert(templatePrimitives).values(
          prims.map((p, idx) => ({
            templateId: inserted.id,
            primitiveId: p.id,
            sortOrder: idx,
          })),
        );
      }

      // Insert capability slots.
      if (capabilityIds.length > 0) {
        await tx.insert(templateCapabilities).values(
          capabilityIds.map((cid) => ({
            templateId: inserted.id,
            capabilityId: cid as string,
          })),
        );
      }

      return tx.query.templates.findFirst({
        where: eq(templates.id, inserted.id),
        with: {
          primitiveLinks: { with: { primitive: true } },
          capabilityLinks: { with: { capability: true } },
        },
      });
    });

    if (!created) {
      throw new Error("Unable to load forked template.");
    }

    // Phase 4: auto-snapshot the new fork.
    await recordVersion({
      entityKind: "template",
      entityId: created.id,
      contentHash: draftHash,
      snapshot: canonicalPayload as unknown as Record<string, unknown>,
      publishedByUserId: userId,
    });

    const bu = created.primitiveLinks.reduce(
      (t, l) => t + (l.primitive?.buCost ?? 0),
      0,
    );

    return NextResponse.json(
      {
        template: { ...created, computedBu: bu },
        dispatchOutcome: {
          kind: "forked" as const,
          newId: created.id,
          sourceId: outcome.sourceId,
          swapTarget: outcome.swapTarget,
        },
      },
      { status: 201 },
    );
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
