import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { characters } from "@/db/schema";
import { validateAttributes, type Attribute } from "@/lib/engine/practices";
import { bustResolverCache } from "@/lib/cache/character-resolver-cache";
import { cumulativeBuForLevel } from "@/lib/engine/bu";
import {
  saveCharacterBundles,
  CharacterBundleVolatilityError,
  type CharacterBundleInput,
} from "@/lib/api/character-bundle-saver";
import { enrichItemLinksWithNestedBundle } from "@/lib/api/enrich-item-links";
import {
  parseBackstory,
  sanitizeBackstory,
  type CharacterBackstory,
} from "@/lib/character/character-backstory";

const VALID_SIZES = [
  "TINY",
  "SMALL",
  "MEDIUM",
  "LARGE",
  "HUGE",
  "GARGANTUAN",
] as const;
const VALID_ATTRS: readonly Attribute[] = ["PHYSICAL", "MENTAL", "MAGICAL"];

function parseSize(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const upper = value.toUpperCase();
  if ((VALID_SIZES as readonly string[]).includes(upper)) return upper;
  return null;
}

function parseAttribute(value: unknown): Attribute | null {
  if (value === null) return null;
  if (typeof value !== "string") return null;
  const upper = value.toUpperCase();
  if ((VALID_ATTRS as readonly string[]).includes(upper)) return upper as Attribute;
  return null;
}

function parseIntInRange(value: unknown, min: number, max: number): number | null {
  const n = Number(value);
  if (!Number.isInteger(n)) return null;
  return Math.max(min, Math.min(max, n));
}

function parseStringArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((x) => Number(x))
    .filter((n) => Number.isInteger(n) && n > 0);
}

function parseUuidArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((x): x is string => typeof x === "string");
}

function emptyToNull(v: unknown): string | null {
  const s = String(v ?? "").trim();
  return s || null;
}


/**
 * GET /api/characters/[id]
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const row = await db.query.characters.findFirst({
    where: eq(characters.id, id),
    with: {
      primitiveLinks: { with: { primitive: true } },
      // Phase 8.4 v5 (Mashu 2026-07-28): include each
      // capability's effects so the Capabilities tab can
      // show effects nested under each capability, matching
      // the character-creation modal's layout.
      capabilityLinks: {
        with: {
          capability: {
            with: {
              effectLinks: { with: { effect: true } },
            },
          },
        },
      },
      // Phase 8.4 v21 (Mashu 2026-07-29): T2 — items nested
      // bundle is fetched separately via flat queries (see
      // below) to AVOID the depth-3+ Drizzle `with:` join
      // that mis-scopes Postgres's LEFT JOIN LATERAL (see
      // /api/items/[id] for the same pattern). The modal and
      // sheet need the nested primitives/capabilities/
      // effects per item, but we have to fetch them
      // out-of-band.
      itemLinks: { with: { item: true } },
      // Phase 8.1 batch 13.1: include heritage slots so the sheet can
      // show "from Lineage 'Elf'" / "from Upbringing 'Scholar'"
      // breadcrumbs alongside the bundle-expanded primitives.
      heritageLinks: {
        with: {
          heritage: {
            with: {
              // Phase 8.4 v3 (Mashu 2026-07-28): the Capabilities
              // tab's "By Heritage" section needs the heritage's
              // canonical bundle (capabilities + primitives) so
              // the user can see what the heritage provides even
              // when the character hasn't slotted any of them.
              //
              // Phase 8.4 v5 / v6 (Mashu 2026-07-28): we
              // deliberately do NOT pull
              // heritage.capabilityLinks.capability.effectLinks
              // here. That would be a depth-3+ Drizzle `with:`
              // join, which mis-scopes Postgres's LEFT JOIN
              // LATERAL and makes the whole character query fail
              // (see the same warning in src/app/atelier/page.tsx
              // lines 102-128 and a depth-3 bug fix in
              // src/app/api/heritage/[id]/route.ts). Effect data
              // for heritage-bundled capabilities isn't needed by
              // the sheet (the modal preloads effect data via its
              // own /api/heritage/[id] fetches).
              capabilityLinks: {
                with: { capability: true },
              },
              primitiveLinks: { with: { primitive: true } },
            },
          },
        },
      },
    },
  });

  if (!row) {
    return NextResponse.json({ error: "Character not found." }, { status: 404 });
  }

  // Phase 8.4 v22 (Mashu 2026-07-29): T2 followup — fetch
  // each slotted item's nested bundle via FLAT queries
  // (NOT depth-3+ Drizzle `with:` joins, which mis-scope
  // Postgres's LEFT JOIN LATERAL — see /api/items/[id] for
  // the same fix). The modal and sheet need this nested
  // data to render items as item-scoped containers with
  // their primitives/capabilities/effects.
  //
  // Per Mashu's spec, item's primitives/caps/effects do
  // NOT enter the character's general primitive pool —
  // they stay scoped to the item.
  await enrichItemLinksWithNestedBundle(row.itemLinks);

  return NextResponse.json({ character: row });
}

/**
 * PATCH /api/characters/[id]
 *
 * Updates mutable character fields. Re-validates BU cap if buSpent/level/dmBonusBu/startingBu changed.
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

    // Get current state for validation
    const current = await db.query.characters.findFirst({
      where: eq(characters.id, id),
    });
    if (!current) {
      return NextResponse.json({ error: "Character not found." }, { status: 404 });
    }

    const updatePayload: Record<string, unknown> = {};

    if ("name" in values) updatePayload["name"] = String(values["name"]).trim();
    if ("size" in values) {
      const s = parseSize(values["size"]);
      if (!s) {
        return NextResponse.json(
          { error: `size must be one of: ${VALID_SIZES.join(", ")}.` },
          { status: 400 },
        );
      }
      updatePayload["size"] = s;
    }
    if ("level" in values) {
      const lv = parseIntInRange(values["level"], 1, 20);
      if (lv === null) {
        return NextResponse.json({ error: "Level must be an integer 1-20." }, { status: 400 });
      }
      updatePayload["level"] = lv;
    }

    // Attributes (validate sum + range)
    const attrKeys: ("attrPhysical" | "attrMental" | "attrMagical")[] = [
      "attrPhysical",
      "attrMental",
      "attrMagical",
    ];
    let attrs: { physical: number; mental: number; magical: number } = {
      physical: current.attrPhysical,
      mental: current.attrMental,
      magical: current.attrMagical,
    };
    for (const k of attrKeys) {
      if (k in values) {
        const v = parseIntInRange(values[k], -1, 5);
        if (v === null) {
          return NextResponse.json(
            { error: `${k} must be an integer in [-1, 5].` },
            { status: 400 },
          );
        }
        attrs[k.replace("attr", "").toLowerCase() as "physical" | "mental" | "magical"] = v;
        updatePayload[k] = v;
      }
    }
    const attrCheck = validateAttributes(attrs);
    if (!attrCheck.valid) {
      return NextResponse.json(
        { error: "Invalid attributes.", details: attrCheck.errors },
        { status: 400 },
      );
    }
    if (attrs.physical + attrs.mental + attrs.magical !== 10) {
      return NextResponse.json(
        { error: "Attributes must sum to exactly 10." },
        { status: 400 },
      );
    }

    if ("attrProficient" in values) {
      updatePayload["attrProficient"] = parseAttribute(values["attrProficient"]);
    }
    if ("practiceSlices" in values) {
      updatePayload["practiceSlices"] =
        values["practiceSlices"] && typeof values["practiceSlices"] === "object"
          ? values["practiceSlices"]
          : {};
    }

    if ("startingBu" in values) {
      const v = parseIntInRange(values["startingBu"], 0, 1000);
      if (v === null) return NextResponse.json({ error: "startingBu must be 0-1000." }, { status: 400 });
      updatePayload["startingBu"] = v;
    }
    if ("buSpent" in values) {
      const v = parseIntInRange(values["buSpent"], 0, 10000);
      if (v === null) return NextResponse.json({ error: "buSpent must be 0-10000." }, { status: 400 });
      updatePayload["buSpent"] = v;
    }
    if ("dmBonusBu" in values) {
      const v = parseIntInRange(values["dmBonusBu"], 0, 1000);
      if (v === null) return NextResponse.json({ error: "dmBonusBu must be 0-1000." }, { status: 400 });
      updatePayload["dmBonusBu"] = v;
    }

    // Validate progression cap with merged values (soft warning only — matches POST behavior)
    const mergedLevel = (updatePayload["level"] as number | undefined) ?? current.level;
    const mergedStarting = (updatePayload["startingBu"] as number | undefined) ?? current.startingBu;
    const mergedBonus = (updatePayload["dmBonusBu"] as number | undefined) ?? current.dmBonusBu;
    const mergedSpent = (updatePayload["buSpent"] as number | undefined) ?? current.buSpent;
    const pool = Math.max(mergedStarting, cumulativeBuForLevel(mergedLevel)) + mergedBonus;
    if (mergedSpent > pool) {
      console.warn(
        `[characters PATCH] soft warning: buSpent=${mergedSpent} > progressionPool=${pool} (character \"${current.name}\")`,
      );
      // Do NOT block — soft warning only per canon (Phase 8.1 batch 13.6)
    }

    if ("enforceTemplateCaps" in values) {
      updatePayload["enforceTemplateCaps"] = Boolean(values["enforceTemplateCaps"]);
    }
    if ("isPublic" in values) updatePayload["isPublic"] = Boolean(values["isPublic"]);
    if ("lineageName" in values) updatePayload["lineageName"] = emptyToNull(values["lineageName"]);
    if ("lineageImageUrl" in values) updatePayload["lineageImageUrl"] = emptyToNull(values["lineageImageUrl"]);
    if ("lineageDescription" in values) updatePayload["lineageDescription"] = emptyToNull(values["lineageDescription"]);
    if ("upbringingName" in values) updatePayload["upbringingName"] = emptyToNull(values["upbringingName"]);
    if ("upbringingImageUrl" in values) updatePayload["upbringingImageUrl"] = emptyToNull(values["upbringingImageUrl"]);
    if ("upbringingDescription" in values) updatePayload["upbringingDescription"] = emptyToNull(values["upbringingDescription"]);
    if ("manifestName" in values) updatePayload["manifestName"] = emptyToNull(values["manifestName"]);
    if ("notes" in values) updatePayload["notes"] = emptyToNull(values["notes"]);
    if ("dmNotes" in values) updatePayload["dmNotes"] = emptyToNull(values["dmNotes"]);
    if ("portraitUrl" in values) updatePayload["portraitUrl"] = emptyToNull(values["portraitUrl"]);
    if ("currentVitality" in values) {
      const v = parseIntInRange(values["currentVitality"], 0, 9999);
      if (v === null) return NextResponse.json({ error: "currentVitality must be a non-negative integer." }, { status: 400 });
      updatePayload["currentVitality"] = v;
    }
    if ("backstory" in values) {
      const rawBackstory = (values as Record<string, unknown>)["backstory"];
      const parsed: CharacterBackstory = parseBackstory(rawBackstory);
      const cleaned = sanitizeBackstory(parsed);
      updatePayload["backstory"] = cleaned;
    }

    updatePayload["updatedAt"] = new Date();

        // Phase 8.4 v18 (Mashu 2026-07-28): the PATCH path now
        // accepts the SAME input shapes as POST (heritages array +
        // primitivesBySource + capabilitiesBySource + itemsBySource).
        // Previously PATCH only handled the flat legacy arrays
        // (primitiveIds / capabilityIds / itemIds) and IGNORED
        // character_heritages entirely. That meant removing all
        // heritages in edit mode and clicking Save left the heritage
        // rows untouched on the sheet.
        //
        // The bundle expansion (which fetches heritage bundles, expands
        // capabilities → primitives → effects, validates the mirror
        // ceiling against the EXPANDED set, and writes the canonical
        // junction rows) now lives in @/lib/api/character-bundle-saver.
        // Both POST and PATCH call saveCharacterBundles() inside their
        // transactions — single source of truth.
        //
        // Back-compat: callers still using the flat legacy arrays
        // (primitiveIds + mirroredPrimitiveIds, capabilityIds, itemIds)
        // continue to work. New callers should send the bundled shape.
        const wantsBundleReplace =
          "heritages" in values ||
          "primitivesBySource" in values ||
          "capabilitiesBySource" in values ||
          "itemsBySource" in values ||
          "primitiveInstances" in values ||
          "primitiveIds" in values ||
          "capabilityIds" in values ||
          "itemIds" in values;

        // Volatility ceiling pre-check: if only flat arrays were sent,
        // we validate up-front (the helper will do it again, more
        // thoroughly, against the expanded set). For the bundled shape,
        // the helper does the check against the full expansion.
        if (wantsBundleReplace && !("heritages" in values || "primitivesBySource" in values || "capabilitiesBySource" in values)) {
          // Legacy path: validate direct primitives only.
          let newPrimitives: Array<{ primitiveId: number; isMirrored: boolean }>;
          if (Array.isArray(values["primitiveInstances"])) {
            newPrimitives = (values["primitiveInstances"] as Array<Record<string, unknown>>)
              .map((e) => ({
                primitiveId: Number(e["primitiveId"]),
                isMirrored: Boolean(e["isMirrored"]),
              }))
              .filter((e) => Number.isInteger(e.primitiveId) && e.primitiveId > 0);
          } else {
            const legacyIds = parseStringArray(values["primitiveIds"] ?? []);
            const legacyMirrors = new Set(
              parseStringArray(values["mirroredPrimitiveIds"] ?? []),
            );
            newPrimitives = legacyIds.map((pid) => ({
              primitiveId: pid,
              isMirrored: legacyMirrors.has(pid),
            }));
          }
          if (newPrimitives.some((p) => p.isMirrored)) {
            // Use the helper's validation indirectly: build a minimal
            // expansion and call validateMirrorSet the same way the
            // helper does. (We could call saveCharacterBundles to do
            // this, but it's a destructive write — we want a dry
            // pre-check here so a failed legacy save can return 400
            // without touching the DB.)
            const { validateMirrorSet } = await import("@/lib/api/volatility");
            const volCheck = await validateMirrorSet(
              mergedLevel,
              newPrimitives.filter((p) => p.isMirrored).map((p) => p.primitiveId),
              newPrimitives.map((p) => p.primitiveId),
            );
            if (!volCheck.ok) {
              return NextResponse.json(
                {
                  error: volCheck.error,
                  ceiling: volCheck.ceiling,
                  rating: volCheck.rating,
                  bracket: volCheck.bracket,
                  offendingPrimitiveId: volCheck.offendingPrimitiveId,
                },
                { status: volCheck.status },
              );
            }
          }
        }

        // Build the input the helper expects, translating from any
        // legacy flat shape into the bundled shape.
        const bundleInput: CharacterBundleInput | null = wantsBundleReplace
          ? buildBundleInputFromRequest(values, mergedLevel, userId, id)
          : null;

        const result = await db.transaction(async (tx) => {
          if (Object.keys(updatePayload).length > 0) {
            await tx.update(characters).set(updatePayload).where(eq(characters.id, id));
          }

          if (bundleInput) {
            await saveCharacterBundles(tx, bundleInput);
          }

          return tx.query.characters.findFirst({
            where: eq(characters.id, id),
            with: {
              primitiveLinks: { with: { primitive: true } },
              // Phase 8.4 v5 (Mashu 2026-07-28): include each
              // capability's effects so the Capabilities tab can
              // show effects nested under each capability, matching
              // the character-creation modal's layout.
              capabilityLinks: {
                with: {
                  capability: {
                    with: {
                      effectLinks: { with: { effect: true } },
                    },
                  },
                },
              },
              // Phase 8.4 v18 (Mashu 2026-07-28): include the
              // heritage links so the sheet's "By Heritage"
              // accordions + the origin chain badges on primitives
              // re-render after a save that included heritage
              // changes. Without this, a Save that removes all
              // heritages would still show them on the sheet
              // (until the user manually refreshed) because the
              // response payload didn't carry heritageLinks.
              heritageLinks: {
                with: {
                  heritage: {
                    with: {
                      capabilityLinks: { with: { capability: true } },
                      primitiveLinks: { with: { primitive: true } },
                    },
                  },
                },
              },
              // Phase 8.4 v21 (Mashu 2026-07-29): T2 — items nested
      // bundle is fetched separately via flat queries (see
      // below) to AVOID the depth-3+ Drizzle `with:` join
      // that mis-scopes Postgres's LEFT JOIN LATERAL (see
      // /api/items/[id] for the same pattern). The modal and
      // sheet need the nested primitives/capabilities/
      // effects per item, but we have to fetch them
      // out-of-band.
      itemLinks: { with: { item: true } },
            },
          });
        });

        // Phase 8.3f S3 (Mashu 2026-07-28): drop the resolver
        // cache so the next /api/characters/[id]/resolve call
        // recomputes with the new attribute values, slotted
        // primitives, mirror state, etc.
        bustResolverCache(id);
        return NextResponse.json({ character: result });
      } catch (error) {
        if (error instanceof CharacterBundleVolatilityError) {
          return NextResponse.json(
            {
              error: error.volCheck.error,
              ceiling: error.volCheck.ceiling,
              rating: error.volCheck.rating,
              bracket: error.volCheck.bracket,
              offendingPrimitiveId: error.volCheck.offendingPrimitiveId,
            },
            { status: error.volCheck.status },
          );
        }
        const message = error instanceof Error ? error.message : "Unknown error.";
        return NextResponse.json({ error: message }, { status: 400 });
      }
    }

    /**
     * Phase 8.4 v18 (Mashu 2026-07-28): translate the PATCH body
     * into the helper's input shape. Handles three formats:
     *
     *   1. BUNDLED (preferred — what POST takes):
     *        heritages: [{id, isMirrored}] | [uuid]
     *        primitivesBySource: { LINEAGE: [{id, isMirrored}], ... }
     *        capabilitiesBySource: { LINEAGE: [{id, isMirrored}], ... }
     *        itemsBySource: { PERSONAL: [{id, quantity}] }
     *
     *   2. FLAT INSTANCES (Phase 8.3b):
     *        primitiveInstances: [{primitiveId, isMirrored}]
     *
     *   3. LEGACY FLAT (Phase 5/8.1):
     *        primitiveIds: [number]
     *        mirroredPrimitiveIds: [number]
     *        capabilityIds: [uuid]
     *        itemIds: [uuid]
     *
     * Legacy shapes get translated into the bundled shape — all
     * primitives become PERSONAL, all capabilities become PERSONAL,
     * all heritages go into the heritages array. The helper then
     * does the expansion uniformly.
     */
    function buildBundleInputFromRequest(
      values: Record<string, unknown>,
      level: number,
      userId: string,
      characterId: string,
    ): CharacterBundleInput {
      // Heritages: accept both array of uuids and array of {id}.
      const heritagesRaw = values["heritages"];
      const heritages: string[] = [];
      if (Array.isArray(heritagesRaw)) {
        for (const h of heritagesRaw) {
          if (typeof h === "string") {
            heritages.push(h);
          } else if (typeof h === "object" && h !== null) {
            const id = (h as Record<string, unknown>)["id"];
            if (typeof id === "string") heritages.push(id);
          }
        }
      }

      // primitivesBySource: read if present; else synthesize from
      // primitiveInstances + legacy primitiveIds.
      const primitivesBySource: Record<
        string,
        Array<{ id: number; isMirrored: boolean }>
      > = {};
      const primBSRaw = values["primitivesBySource"];
      if (primBSRaw && typeof primBSRaw === "object") {
        for (const [source, list] of Object.entries(
          primBSRaw as Record<string, unknown>,
        )) {
          if (!Array.isArray(list)) continue;
          primitivesBySource[source] = [];
          for (const entry of list) {
            if (typeof entry !== "object" || entry === null) continue;
            const e = entry as Record<string, unknown>;
            const id = Number(e["id"]);
            if (!Number.isInteger(id) || id <= 0) continue;
            primitivesBySource[source].push({
              id,
              isMirrored: Boolean(e["isMirrored"]),
            });
          }
        }
      }

      // primitiveInstances: feed into PERSONAL when no bundled shape.
      const primitiveInstances: Array<{ primitiveId: number; isMirrored: boolean }> = [];
      if (Array.isArray(values["primitiveInstances"])) {
        for (const entry of values["primitiveInstances"] as Array<Record<string, unknown>>) {
          const pid = Number(entry["primitiveId"]);
          if (!Number.isInteger(pid) || pid <= 0) continue;
          primitiveInstances.push({
            primitiveId: pid,
            isMirrored: Boolean(entry["isMirrored"]),
          });
        }
      } else if (Array.isArray(values["primitiveIds"])) {
        // Legacy flat: convert to PERSONAL instances.
        const legacyMirrors = new Set(
          parseStringArray(values["mirroredPrimitiveIds"] ?? []),
        );
        for (const pid of parseStringArray(values["primitiveIds"])) {
          primitiveInstances.push({
            primitiveId: pid,
            isMirrored: legacyMirrors.has(pid),
          });
        }
      }

      // capabilitiesBySource: read if present; else synthesize from
      // legacy capabilityIds as PERSONAL.
      const capabilitiesBySource: Record<
        string,
        Array<{ id: string; isMirrored: boolean }>
      > = {};
      const capsBSRaw = values["capabilitiesBySource"];
      if (capsBSRaw && typeof capsBSRaw === "object") {
        for (const [source, list] of Object.entries(
          capsBSRaw as Record<string, unknown>,
        )) {
          if (!Array.isArray(list)) continue;
          capabilitiesBySource[source] = [];
          for (const entry of list) {
            if (typeof entry !== "object" || entry === null) continue;
            const e = entry as Record<string, unknown>;
            const id = String(e["id"]);
            if (!id) continue;
            capabilitiesBySource[source].push({
              id,
              isMirrored: Boolean(e["isMirrored"]),
            });
          }
        }
      }
      if (Array.isArray(values["capabilityIds"])) {
        const personal = capabilitiesBySource["PERSONAL"] ?? [];
        for (const cid of parseUuidArray(values["capabilityIds"])) {
          personal.push({ id: cid, isMirrored: false });
        }
        capabilitiesBySource["PERSONAL"] = personal;
      }
      // Phase 8.4 v24.5 (Mashu 2026-07-29): T5 — save
      // regression fix. The modal sends BOTH the bundled shape
      // (capabilitiesBySource) AND the legacy flat shape
      // (capabilityIds) for back-compat, mirroring the items
      // shape. Items are deduped at the top of the itemsBySource
      // section (see "bundledHasEntries" check below). We need
      // the same treatment here: when bundled is non-empty,
      // ignore legacy capabilityIds. Otherwise direct caps
      // from the modal get pushed TWICE into PERSONAL.
      //
      // Mashu's repro confirmed the merge was buggy: cap added
      // via modal showed briefly in BU footer (local compute
      // reads pendingSlots), but never persisted because the
      // duplicate PK row caused the insert to either silently
      // skip (Map.set dedupe in expander) or, in some edge
      // cases, throw and roll back the transaction.
      const capBundledHasEntries =
        capsBSRaw &&
        typeof capsBSRaw === "object" &&
        Object.values(capsBSRaw as Record<string, unknown>).some(
          (v) => Array.isArray(v) && v.length > 0,
        );
      if (capBundledHasEntries && Array.isArray(values["capabilityIds"])) {
        const legacyCount = (values["capabilityIds"] as unknown[]).length;
        console.warn(
          `[characters PATCH ${characterId}] capabilitiesBySource received BOTH bundled (trusting) AND legacy capabilityIds (${legacyCount} ids). Discarding legacy to avoid duplicates.`,
          {
            bundledCounts: Object.fromEntries(
              Object.entries(capabilitiesBySource).map(([k, v]) => [
                k,
                v.length,
              ]),
            ),
          },
        );
        // Hard-cut: re-derive capabilitiesBySource from the
        // bundled shape alone, dropping any legacy merge.
        // We rebuild only the keys that were present in the
        // bundled shape — anything else is dropped.
        const rebuilt: Record<
          string,
          Array<{ id: string; isMirrored: boolean }>
        > = {};
        for (const [source, list] of Object.entries(
          capsBSRaw as Record<string, unknown>,
        )) {
          if (!Array.isArray(list)) continue;
          rebuilt[source] = [];
          for (const entry of list) {
            if (typeof entry !== "object" || entry === null) continue;
            const e = entry as Record<string, unknown>;
            const cid = String(e["id"]);
            if (!cid) continue;
            rebuilt[source]!.push({
              id: cid,
              isMirrored: Boolean(e["isMirrored"]),
            });
          }
        }
        // Replace capabilitiesBySource keys with rebuilt version.
        // Anything not in capsBSRaw gets cleared.
        for (const k of Object.keys(capabilitiesBySource)) {
          if (k in rebuilt) {
            capabilitiesBySource[k] = rebuilt[k]!;
          } else {
            capabilitiesBySource[k] = [];
          }
        }
      }

      // itemsBySource: read if present; else synthesize from
      // legacy itemIds as PERSONAL.
      const itemsBySource: Record<
        string,
        Array<{ id: string; quantity: number; equipped?: boolean }>
      > = {};
      const itemsBSRaw = values["itemsBySource"];
      // Phase 8.4 v20 (Mashu 2026-07-29): T1 — Save with items
      // PK violation. The PATCH modal sends BOTH the bundled
      // shape (itemsBySource) AND the legacy flat shape (itemIds)
      // for back-compat. Previously this route merged them
      // blindly, producing duplicate (character_id, item_id)
      // rows in character_items.
      //
      // Fix: when itemsBySource is present and has any entries,
      // trust it as the source of truth and IGNORE legacy
      // itemIds. Only fall back to legacy itemIds when the
      // bundled shape is missing/empty (so old callers still
      // work).
      const bundledHasEntries =
        itemsBSRaw &&
        typeof itemsBSRaw === "object" &&
        Object.values(itemsBSRaw as Record<string, unknown>).some(
          (v) => Array.isArray(v) && v.length > 0,
        );
      if (bundledHasEntries) {
        for (const [source, list] of Object.entries(
          itemsBSRaw as Record<string, unknown>,
        )) {
          if (!Array.isArray(list)) continue;
          itemsBySource[source] = [];
          for (const entry of list) {
            if (typeof entry !== "object" || entry === null) continue;
            const e = entry as Record<string, unknown>;
            const id = String(e["id"]);
            if (!id) continue;
            const q = Number(e["quantity"] ?? 1);
            itemsBySource[source].push({
              id,
              quantity: Number.isInteger(q) && q > 0 ? q : 1,
              // Phase 8.4 v21 (Mashu 2026-07-29): T2 — equipped.
              equipped: Boolean(e["equipped"]),
            });
          }
        }
      } else if (Array.isArray(values["itemIds"])) {
        // Legacy fallback: synthesize itemsBySource from itemIds.
        itemsBySource["PERSONAL"] = parseUuidArray(values["itemIds"]).map(
          (iid) => ({ id: iid, quantity: 1 }),
        );
      }

      return {
        userId,
        characterId,
        level,
        heritages,
        primitivesBySource,
        capabilitiesBySource,
        itemsBySource,
        primitiveInstances,
      };
    }

/**
 * DELETE /api/characters/[id]
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await auth.protect();
    const { id } = await params;

    const [deleted] = await db
      .delete(characters)
      .where(eq(characters.id, id))
      .returning({ id: characters.id });

    if (!deleted) {
      return NextResponse.json({ error: "Character not found." }, { status: 404 });
    }

    // Phase 8.3f S3 (Mashu 2026-07-28): drop the resolver
    // cache for this character so any stale /resolve entries
    // don't survive the delete.
    bustResolverCache(id);

    return NextResponse.json({ deleted: deleted.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}