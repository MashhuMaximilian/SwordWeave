import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { capabilities, capabilityPrimitives } from "@/db/schema";

/**
 * POST /api/capabilities/[id]/clone
 *
 * Creates a user-owned editable copy of a public capability.
 * The new capability gets a unique name (suffix " (Copy)" or " (Copy N)" if collisions)
 * and is_public = false by default. All primitive links are copied.
 *
 * Per UX-WORKFLOW-SPEC: "Clone = frozen copy + check-for-updates button"
 * For now: a deep copy with provenance metadata. The frozen-copy/check-for-updates
 * versioning ships later in Tier 3.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await auth.protect();
    const { id } = await params;

    // Load source capability with primitive links
    const source = await db.query.capabilities.findFirst({
      where: eq(capabilities.id, id),
      with: {
        primitiveLinks: true,
      },
    });

    if (!source) {
      return NextResponse.json({ error: "Capability not found." }, { status: 404 });
    }

    // Generate unique name: "<original> (Copy)" or "<original> (Copy N)"
    let newName = `${source.name} (Copy)`;
    let copyNumber = 2;
    while (true) {
      const existing = await db.query.capabilities.findFirst({
        where: eq(capabilities.name, newName),
      });
      if (!existing) break;
      newName = `${source.name} (Copy ${copyNumber})`;
      copyNumber++;
      if (copyNumber > 99) {
        // sanity bound
        return NextResponse.json(
          { error: "Too many copies of this capability. Rename some first." },
          { status: 400 },
        );
      }
    }

    // Create the cloned capability (provenance in metadata)
    const [cloned] = await db
      .insert(capabilities)
      .values({
        name: newName,
        type: source.type,
        sourceType: source.sourceType,
        verboseDescription: source.verboseDescription,
        isPublic: false, // user-owned copy is private by default
        sourceOrigin: `Cloned from ${source.name}`,
        tags: source.tags,
        metadata: {
          ...source.metadata,
          clonedFromId: source.id,
          clonedFromName: source.name,
          clonedAt: new Date().toISOString(),
        },
      })
      .returning();

    if (!cloned) {
      throw new Error("Failed to create cloned capability.");
    }

    // Copy all primitive links (preserving sort_order, quantity, role, slotLabel)
    if (source.primitiveLinks.length > 0) {
      await db.insert(capabilityPrimitives).values(
        source.primitiveLinks.map((link) => ({
          capabilityId: cloned.id,
          primitiveId: link.primitiveId,
          role: link.role,
          quantity: link.quantity,
          sortOrder: link.sortOrder,
          slotLabel: link.slotLabel,
          notes: link.notes,
        })),
      );
    }

    // Return full cloned capability
    const result = await db.query.capabilities.findFirst({
      where: eq(capabilities.id, cloned.id),
      with: {
        primitiveLinks: {
          with: {
            primitive: true,
          },
        },
      },
    });

    return NextResponse.json({ capability: result }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}