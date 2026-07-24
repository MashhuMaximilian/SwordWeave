import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import {
  capabilityEffects,
  capabilityPrimitives,
  characterCapabilities,
  characterHeritages,
  characterItems,
  characterPrimitives,
  characters,
  effectPrimitives,
  effects,
  heritage,
  heritageCapabilities,
  heritagePrimitives,
  primitives,
  capabilities,
  items,
} from "@/db/schema";
import { validateAttributes, type Attribute } from "@/lib/engine/practices";
import { validateMirrorSet } from "@/lib/api/volatility";
import { cumulativeBuForLevel } from "@/lib/engine/bu";
import {
  expandBundles,
  type BundleExpansionInput,
  type CharacterPrimitiveSource,
} from "@/lib/engine/bundle-expander";
import {
  resolveLatestVersionId,
  resolveSlotSource,
} from "@/lib/versions/slot-source";

const VALID_SIZES = [
  "TINY",
  "SMALL",
  "MEDIUM",
  "LARGE",
  "HUGE",
  "GARGANTUAN",
] as const;
type CharacterSize = (typeof VALID_SIZES)[number];

const VALID_ATTRS: readonly Attribute[] = ["PHYSICAL", "MENTAL", "MAGICAL"];

function parseSize(value: unknown): CharacterSize {
  if (typeof value !== "string") return "MEDIUM";
  const upper = value.toUpperCase();
  if ((VALID_SIZES as readonly string[]).includes(upper)) {
    return upper as CharacterSize;
  }
  return "MEDIUM";
}

function parseAttribute(value: unknown): Attribute | null {
  if (typeof value !== "string") return null;
  const upper = value.toUpperCase();
  if ((VALID_ATTRS as readonly string[]).includes(upper)) {
    return upper as Attribute;
  }
  return null;
}

function parseIntInRange(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value);
  if (!Number.isInteger(n)) return fallback;
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

/**
 * GET /api/characters
 *
 * Lists characters. If authenticated, returns user's characters + public ones.
 * Optional filter: ?user=me
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userFilter = searchParams.get("user");

  let whereClause: ReturnType<typeof eq> | undefined;
  if (userFilter === "me") {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    whereClause = eq(characters.userId, userId);
  }

  const rows = await db.query.characters.findMany({
    where: whereClause,
    orderBy: [asc(characters.level), asc(characters.name)],
    with: {
      primitiveLinks: { with: { primitive: true } },
      capabilityLinks: { with: { capability: true } },
      itemLinks: { with: { item: true } },
    },
  });

  return NextResponse.json({ characters: rows });
}

/**
 * POST /api/characters
 *
 * Create a new character. Requires authentication.
 *
 * Body (Phase 8.1 batch 13.1 — expanded for bundle expansion):
 *   - name (required)
 *   - size (default MEDIUM)
 *   - level (>= 1, default 1, no upper cap)
 *   - attrPhysical, attrMental, attrMagical (must sum to 10, each in [-1, 5])
 *   - attrProficient (PHYSICAL | MENTAL | MAGICAL, optional)
 *   - practiceSlices (object, optional)
 *   - lineageName, lineageImageUrl, lineageDescription (optional — direct fields)
 *   - upbringingName, upbringingImageUrl, upbringingDescription (optional)
 *   - manifestName (optional)
 *   - startingBu (default 25) — canonically fixed at 25 for level mode
 *   - buBudget (optional, default null) — when set, used as the
 *     startingBu override (buBudget mode). Server validates the
 *     typed value against cumulative(level) and the debt ceiling.
 *   - buSpent (default 0) — must be <= max(startingBu,
 *     cumulative(level)) + dm_bonus_bu
 *   - dmBonusBu (default 0)
 *   - enforceTemplateCaps (default false)
 *   - isPublic (default false)
 *   - primitiveIds, capabilityIds, itemIds (legacy flat arrays, optional)
 *     OR
 *   - primitivesBySource: { LINEAGE: [{id, isMirrored}], UPBRINGING: [...],
 *     MANIFEST: [...], PERSONAL: [...] } (preferred)
 *   - capabilitiesBySource: same shape
 *   - itemsBySource: { PERSONAL: [{id, quantity}] }
 *   - heritages: [{id, isMirrored}] (lineage/upbringing/manifest slots)
 *
 * Bundle expansion: every slotted heritage expands its bundled
 * primitives + capabilities + capability effects into
 * `character_primitives` rows. Every direct capability expands its
 * primitives + effects. Every direct effect expands its primitives.
 * Dedupe is by primitive_id (one row per primitive per character).
 *
 * Item BU is tracked SEPARATELY — items don't contribute to the
 * progression pool (see docs/phase-8/CREATION-MODAL-FLOW.md).
 */
export async function POST(request: Request) {
  try {
    const { userId } = await auth.protect();
    const body: unknown = await request.json();

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const values = body as Record<string, unknown>;
    const name = String(values["name"] ?? "").trim();
    if (!name) {
      return NextResponse.json({ error: "Name is required." }, { status: 400 });
    }

    const size = parseSize(values["size"]);
    // Phase 8.1 batch 10g: no upper level cap. Phase 8.1 batch 11
    // (Mashu 2026-07-22) made levels 1+ the only constraint; the
    // cumulative BU formula extrapolates indefinitely (L100 = 2315).
    const level = parseIntInRange(values["level"], 1, Number.MAX_SAFE_INTEGER, 1);
    const attrPhysical = parseIntInRange(values["attrPhysical"], -1, 5, 0);
    const attrMental = parseIntInRange(values["attrMental"], -1, 5, 0);
    const attrMagical = parseIntInRange(values["attrMagical"], -1, 5, 0);
    const attrProficient = parseAttribute(values["attrProficient"]);

    // Validate attributes sum to 10 and within range
    const attrCheck = validateAttributes({
      physical: attrPhysical,
      mental: attrMental,
      magical: attrMagical,
    });
    if (!attrCheck.valid) {
      return NextResponse.json(
        { error: "Invalid attributes.", details: attrCheck.errors },
        { status: 400 },
      );
    }
    if (attrPhysical + attrMental + attrMagical !== 10) {
      return NextResponse.json(
        { error: "Attributes must sum to exactly 10." },
        { status: 400 },
      );
    }

    const startingBuDefault = 25;
    // Phase 8.2 batch 12: buBudget is "provided" only when the client
    // explicitly sends a finite number. `null` (Level mode) and
    // missing key both mean "use the default startingBu". Treating
    // null as 0 used to silently cap the progression pool at the
    // canon minimum and reject any over-canon-spending build.
    const rawBuBudget = values["buBudget"];
    const buBudgetProvided =
      typeof rawBuBudget === "number" &&
      Number.isFinite(rawBuBudget) &&
      rawBuBudget >= 0 &&
      rawBuBudget <= 100000;
    // Phase 8.1 batch 10g: in "By BU" mode the client sends both
    // level (implied) and buBudget (typed). buBudget becomes the
    // startingBu override. In "By Level" mode buBudget is null and
    // startingBu defaults to 25.
    const startingBu = buBudgetProvided
      ? Math.floor(rawBuBudget as number)
      : parseIntInRange(values["startingBu"], 0, 100000, startingBuDefault);
    const buSpent = parseIntInRange(values["buSpent"], 0, 100000, 0);
    const dmBonusBu = parseIntInRange(values["dmBonusBu"], 0, 100000, 0);

    // Phase 8.1 batch 10g: progressionPool uses the canon cumulative
    // formula. Previously this was startingBu + (level-1)*5 + dmBonusBu
    // which gave 40 at L4 (canon is 59) and was wrong at every spike
    // level. Now: max(startingBu, cumulative(level)) + dmBonusBu. The
    // max() handles both "By Level" mode (startingBu=25, canon wins
    // for L>=1) and "By BU" mode (startingBu=user value, user's value
    // wins when it exceeds canon for that implied level).
    const progressionPool =
      Math.max(startingBu, cumulativeBuForLevel(level)) + dmBonusBu;
    // Phase 8.1 batch 13.6 follow-up (Mashu 2026-07-22):
        // "When a player is above budget soft warning only."
        //
        // Migration 0047 dropped the DB CHECK constraint so this soft-warn
        // path is now the only enforcement. The client renders a red BU
        // footer when buSpent > progressionPool; the server just logs so
        // we can spot bad builds in dev. Mirror debt still hard-fails
        // (see maxBuDebtForLevel on client + server) because that breaks
        // canon mechanics.
        if (buSpent > progressionPool) {
          console.warn(
            `[characters POST] soft warning: buSpent=${buSpent} > progressionPool=${progressionPool} (character "${name}")`,
          );
        }

    const enforceTemplateCaps = Boolean(values["enforceTemplateCaps"]);
    const isPublic = Boolean(values["isPublic"]);
    const sourceOrigin = String(values["sourceOrigin"] ?? "").trim() || "manual";

    const practiceSlices =
      values["practiceSlices"] && typeof values["practiceSlices"] === "object"
        ? (values["practiceSlices"] as Record<string, unknown>)
        : {};

    // Phase 8.2 batch 8: read currentVitality. The modal sends this on
    // create (= vitalityMax, "full health") and on edit (= seeded
    // value, preserve across edits). Missing → null → DB default null.
    const currentVitalityRaw = values["currentVitality"];
    const currentVitality =
      currentVitalityRaw === null || currentVitalityRaw === undefined
        ? null
        : (parseIntInRange(currentVitalityRaw, 0, 99999, 0) as number | null);

    // Phase 8.2 batch 3: backstory freeform fields
    const rawBackstory = values["backstory"];
    let backstory: { origin: string; motivation: string; ties: string; flaw: string } | null = null;
    if (rawBackstory && typeof rawBackstory === "object") {
      const rb = rawBackstory as Record<string, unknown>;
      backstory = {
        origin: typeof rb["origin"] === "string" ? (rb["origin"] as string).trim() : "",
        motivation: typeof rb["motivation"] === "string" ? (rb["motivation"] as string).trim() : "",
        ties: typeof rb["ties"] === "string" ? (rb["ties"] as string).trim() : "",
        flaw: typeof rb["flaw"] === "string" ? (rb["flaw"] as string).trim() : "",
      };
    }

    // Phase 8.2 batch 8: lineage/upbringing/manifest names start as
    // whatever the modal sent (typically null — the modal doesn't
    // send them anymore), and the heritage-derivation block below
    // overwrites them based on which heritage the user slotted.
    let lineageName = String(values["lineageName"] ?? "").trim() || null;
    let lineageImageUrl = String(values["lineageImageUrl"] ?? "").trim() || null;
    let lineageDescription = String(values["lineageDescription"] ?? "").trim() || null;
    let upbringingName = String(values["upbringingName"] ?? "").trim() || null;
    let upbringingImageUrl = String(values["upbringingImageUrl"] ?? "").trim() || null;
    let upbringingDescription = String(values["upbringingDescription"] ?? "").trim() || null;
    let manifestName = String(values["manifestName"] ?? "").trim() || null;
    const notes = String(values["notes"] ?? "").trim() || null;
    const dmNotes = String(values["dmNotes"] ?? "").trim() || null;
    const portraitUrl = String(values["portraitUrl"] ?? "").trim() || null;

    const primitiveIds = parseStringArray(values["primitiveIds"]);
    const capabilityIds = parseUuidArray(values["capabilityIds"]);
    const itemIds = parseUuidArray(values["itemIds"]);

    // Phase 8.1 batch 13.1: read source-keyed shapes too. Modal
    // sends primitivesBySource / capabilitiesBySource / itemsBySource
    // / heritages. If those are present, prefer them over the flat
    // arrays (they carry per-slot mirror + source info).
    const rawPrimBySource =
      (values["primitivesBySource"] as Record<string, unknown> | undefined) ??
      {};
    const rawCapsBySource =
      (values["capabilitiesBySource"] as Record<string, unknown> | undefined) ??
      {};
    const rawItemsBySource =
      (values["itemsBySource"] as Record<string, unknown> | undefined) ?? {};
    const rawHeritages = parseUuidArray(
      (values["heritages"] as unknown[] | undefined)?.map((h) =>
        typeof h === "object" && h !== null
          ? (h as Record<string, unknown>)["id"]
          : h,
      ),
    );

    // Build the BundleExpansionInput. Walk each source tab in
    // primitivesBySource / capabilitiesBySource; tag each slot with
    // its source. Items don't expand into primitives — they only
    // get written to character_items. Heritages get their bundle
    // fetched fresh from the DB.
    const expansionInput: BundleExpansionInput = {
      heritages: [], // populated below after bundle fetch
      capabilities: [],
      effects: [],
      primitives: [],
    };

    // Direct primitive slots (from primitivesBySource).
    for (const [source, list] of Object.entries(rawPrimBySource)) {
      if (!Array.isArray(list)) continue;
      for (const entry of list) {
        if (typeof entry !== "object" || entry === null) continue;
        const e = entry as Record<string, unknown>;
        const id = Number(e["id"]);
        if (!Number.isInteger(id) || id <= 0) continue;
        expansionInput.primitives.push({
          primitiveId: id,
          source: source as CharacterPrimitiveSource,
          isMirrored: Boolean(e["isMirrored"]),
        });
      }
    }
    // Direct capability slots (from capabilitiesBySource).
    const directCapabilityIdsBySource: Array<{
      id: string;
      source: CharacterPrimitiveSource;
    }> = [];
    for (const [source, list] of Object.entries(rawCapsBySource)) {
      if (!Array.isArray(list)) continue;
      for (const entry of list) {
        if (typeof entry !== "object" || entry === null) continue;
        const e = entry as Record<string, unknown>;
        const id = String(e["id"]);
        if (!id) continue;
        directCapabilityIdsBySource.push({
          id,
          source: source as CharacterPrimitiveSource,
        });
      }
    }

    // Mirrored primitive IDs (subset of primitiveIds) — legacy
    // shape. The source-keyed shape carries isMirrored per slot,
    // so we don't need to extract mirrors here.
    const mirroredPrimitiveIds = primitiveIds;

    // === Phase 8.1 batch 13.1: bundle expansion ===
    // Fetch heritage bundles (kind + primitiveLinks + capabilityLinks
    // with their own primitiveLinks + effectLinks with primitiveLinks).
    // Fetch direct capability bundles the same way. Direct effect
    // bundles for effects that are slotted standalone (no path in the
    // modal today, but the schema + expander support it).

    // Heritages
    if (rawHeritages.length > 0) {
      // Phase 8.2 batch 8: include name/imageUrl/description so the
      // server can derive lineageName/lineageImageUrl/.../manifestName
      // from the slotted heritage bundle. The modal no longer sends
      // those fields itself (sending null would wipe them on every
      // save — see Phase 8.1 batch 13.6 follow-up).
      const heritageRows = await db
        .select({
          id: heritage.id,
          kind: heritage.kind,
          name: heritage.name,
          imageUrl: heritage.imageUrl,
          description: heritage.description,
        })
        .from(heritage)
        .where(inArray(heritage.id, rawHeritages));
      const primLinksByHeritage = new Map<
        string,
        Array<{ primitiveId: number; isMirrored: boolean }>
      >();
      const capLinksByHeritage = new Map<
        string,
        Array<{ capabilityId: string }>
      >();
      const hpRows = await db
        .select({
          templateId: heritagePrimitives.templateId,
          primitiveId: heritagePrimitives.primitiveId,
          isMirrored: heritagePrimitives.isMirrored,
        })
        .from(heritagePrimitives)
        .where(inArray(heritagePrimitives.templateId, rawHeritages));
      for (const r of hpRows) {
        const list = primLinksByHeritage.get(r.templateId) ?? [];
        list.push({ primitiveId: r.primitiveId, isMirrored: r.isMirrored });
        primLinksByHeritage.set(r.templateId, list);
      }
      const hcRows = await db
        .select({
          templateId: heritageCapabilities.templateId,
          capabilityId: heritageCapabilities.capabilityId,
        })
        .from(heritageCapabilities)
        .where(inArray(heritageCapabilities.templateId, rawHeritages));
      for (const r of hcRows) {
        const list = capLinksByHeritage.get(r.templateId) ?? [];
        list.push({ capabilityId: r.capabilityId });
        capLinksByHeritage.set(r.templateId, list);
      }

      // Capability bundles within heritages
      const allHeritageCapabilityIds = Array.from(
        new Set(hcRows.map((r) => r.capabilityId)),
      );
      const capPrimLinksByCap = new Map<
        string,
        Array<{ primitiveId: number; isMirrored: boolean }>
      >();
      const capEffLinksByCap = new Map<string, Array<{ effectId: string }>>();
      if (allHeritageCapabilityIds.length > 0) {
        const cpRows = await db
          .select({
            capabilityId: capabilityPrimitives.capabilityId,
            primitiveId: capabilityPrimitives.primitiveId,
            isMirrored: capabilityPrimitives.isMirrored,
          })
          .from(capabilityPrimitives)
          .where(inArray(capabilityPrimitives.capabilityId, allHeritageCapabilityIds));
        for (const r of cpRows) {
          const list = capPrimLinksByCap.get(r.capabilityId) ?? [];
          list.push({ primitiveId: r.primitiveId, isMirrored: r.isMirrored });
          capPrimLinksByCap.set(r.capabilityId, list);
        }
        const ceRows = await db
          .select({
            capabilityId: capabilityEffects.capabilityId,
            effectId: capabilityEffects.effectId,
          })
          .from(capabilityEffects)
          .where(inArray(capabilityEffects.capabilityId, allHeritageCapabilityIds));
        for (const r of ceRows) {
          const list = capEffLinksByCap.get(r.capabilityId) ?? [];
          list.push({ effectId: r.effectId });
          capEffLinksByCap.set(r.capabilityId, list);
        }
      }
      // Effect primitive links
      const allEffectIds = Array.from(
        new Set(
          Array.from(capEffLinksByCap.values()).flatMap((l) =>
            l.map((x) => x.effectId),
          ),
        ),
      );
      const effectPrimLinksByEffect = new Map<
        string,
        Array<{ primitiveId: number; isMirrored: boolean }>
      >();
      if (allEffectIds.length > 0) {
        const epRows = await db
          .select({
            effectId: effectPrimitives.effectId,
            primitiveId: effectPrimitives.primitiveId,
            isMirrored: effectPrimitives.isMirrored,
          })
          .from(effectPrimitives)
          .where(inArray(effectPrimitives.effectId, allEffectIds));
        for (const r of epRows) {
          const list = effectPrimLinksByEffect.get(r.effectId) ?? [];
          list.push({ primitiveId: r.primitiveId, isMirrored: r.isMirrored });
          effectPrimLinksByEffect.set(r.effectId, list);
        }
      }

      for (const row of heritageRows) {
        expansionInput.heritages.push({
          id: row.id,
          kind: row.kind,
          primitiveLinks: (primLinksByHeritage.get(row.id) ?? []).map((p) => ({
            primitiveId: p.primitiveId,
            isMirrored: p.isMirrored,
          })),
          capabilityLinks: (capLinksByHeritage.get(row.id) ?? []).map(
            (c) => ({
              capabilityId: c.capabilityId,
              primitiveLinks: (capPrimLinksByCap.get(c.capabilityId) ?? []).map(
                (p) => ({
                  primitiveId: p.primitiveId,
                  isMirrored: p.isMirrored,
                }),
              ),
              effectLinks: (capEffLinksByCap.get(c.capabilityId) ?? []).map(
                (e) => ({
                  effectId: e.effectId,
                  primitiveLinks: (
                    effectPrimLinksByEffect.get(e.effectId) ?? []
                  ).map((p) => ({
                    primitiveId: p.primitiveId,
                    isMirrored: p.isMirrored,
                  })),
                }),
              ),
            }),
          ),
        });
      }

      // Phase 8.2 batch 8: derive the lineage/upbringing/manifest
      // display fields from whichever heritage the user slotted in
      // that kind. If the user slots multiple heritages of the same
      // kind we just use the first match (canonical layout is one
      // each). These overwrite the empty values from the body — the
      // modal no longer sends these fields (see Phase 8.1 batch 13.6
      // follow-up, sending null was wiping them on every save).
      for (const row of heritageRows) {
        if (row.kind === "LINEAGE") {
          if (lineageName === null && row.name) lineageName = row.name;
          if (lineageImageUrl === null && row.imageUrl)
            lineageImageUrl = row.imageUrl;
          if (lineageDescription === null && row.description)
            lineageDescription = row.description;
        } else if (row.kind === "UPBRINGING") {
          if (upbringingName === null && row.name) upbringingName = row.name;
          if (upbringingImageUrl === null && row.imageUrl)
            upbringingImageUrl = row.imageUrl;
          if (upbringingDescription === null && row.description)
            upbringingDescription = row.description;
        } else if (row.kind === "MANIFEST") {
          if (manifestName === null && row.name) manifestName = row.name;
        }
      }
    }

    // Direct capability bundles (those not inside a heritage)
    const directCapsOnly = directCapabilityIdsBySource.filter(
      (c) =>
        !expansionInput.heritages.some((h) =>
          h.capabilityLinks.some((cl) => cl.capabilityId === c.id),
        ),
    );
    if (directCapsOnly.length > 0) {
      const directCapIds = directCapsOnly.map((c) => c.id);
      const cpRows = await db
        .select({
          capabilityId: capabilityPrimitives.capabilityId,
          primitiveId: capabilityPrimitives.primitiveId,
          isMirrored: capabilityPrimitives.isMirrored,
        })
        .from(capabilityPrimitives)
        .where(inArray(capabilityPrimitives.capabilityId, directCapIds));
      const directCapPrimLinks = new Map<
        string,
        Array<{ primitiveId: number; isMirrored: boolean }>
      >();
      for (const r of cpRows) {
        const list = directCapPrimLinks.get(r.capabilityId) ?? [];
        list.push({ primitiveId: r.primitiveId, isMirrored: r.isMirrored });
        directCapPrimLinks.set(r.capabilityId, list);
      }
      const ceRows = await db
        .select({
          capabilityId: capabilityEffects.capabilityId,
          effectId: capabilityEffects.effectId,
        })
        .from(capabilityEffects)
        .where(inArray(capabilityEffects.capabilityId, directCapIds));
      const directCapEffLinks = new Map<string, Array<{ effectId: string }>>();
      for (const r of ceRows) {
        const list = directCapEffLinks.get(r.capabilityId) ?? [];
        list.push({ effectId: r.effectId });
        directCapEffLinks.set(r.capabilityId, list);
      }
      const directEffectIds = Array.from(
        new Set(
          Array.from(directCapEffLinks.values()).flatMap((l) =>
            l.map((x) => x.effectId),
          ),
        ),
      );
      const directEffPrimLinks = new Map<
        string,
        Array<{ primitiveId: number; isMirrored: boolean }>
      >();
      if (directEffectIds.length > 0) {
        const epRows = await db
          .select({
            effectId: effectPrimitives.effectId,
            primitiveId: effectPrimitives.primitiveId,
            isMirrored: effectPrimitives.isMirrored,
          })
          .from(effectPrimitives)
          .where(inArray(effectPrimitives.effectId, directEffectIds));
        for (const r of epRows) {
          const list = directEffPrimLinks.get(r.effectId) ?? [];
          list.push({ primitiveId: r.primitiveId, isMirrored: r.isMirrored });
          directEffPrimLinks.set(r.effectId, list);
        }
      }
      for (const c of directCapsOnly) {
        expansionInput.capabilities.push({
          id: c.id,
          source: c.source,
          primitiveLinks: (directCapPrimLinks.get(c.id) ?? []).map((p) => ({
            primitiveId: p.primitiveId,
            isMirrored: p.isMirrored,
          })),
          effectLinks: (directCapEffLinks.get(c.id) ?? []).map((e) => ({
            effectId: e.effectId,
            primitiveLinks: (directEffPrimLinks.get(e.effectId) ?? []).map(
              (p) => ({
                primitiveId: p.primitiveId,
                isMirrored: p.isMirrored,
              }),
            ),
          })),
        });
      }
    }

    // Run the expander.
    const expansion = expandBundles(expansionInput);
    const expandedPrimitiveIds = expansion.primitives.map(
      (p) => p.primitiveId,
    );
    const expandedCapabilityIds = expansion.capabilities.map(
      (c) => c.capabilityId,
    );

    // Validate volatility ceiling BEFORE writing (fail fast).
    // We validate against the EXPANDED primitive set so any
    // mirror-vector primitive in a bundle counts toward the ceiling.
    const volCheck = await validateMirrorSet(
      level,
      expansion.primitives.filter((p) => p.isMirrored).map((p) => p.primitiveId),
      expandedPrimitiveIds,
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

    const result = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(characters)
        .values({
          userId,
          name,
          size,
          level,
          attrPhysical,
          attrMental,
          attrMagical,
          attrProficient,
          practiceSlices,
          lineageName,
          lineageImageUrl,
          lineageDescription,
          upbringingName,
          upbringingImageUrl,
          upbringingDescription,
          manifestName,
          startingBu,
          buSpent,
          dmBonusBu,
          enforceTemplateCaps,
          isPublic,
          sourceOrigin,
          notes,
          dmNotes,
          portraitUrl,
          currentVitality,
          backstory,
        })
        .returning();

      if (!created) throw new Error("Unable to create character.");

      // === Phase 8.1 batch 13.1: write expanded primitives with origin ===
      if (expansion.primitives.length > 0) {
        // Fetch version_id + slot_source for each primitive row.
        // We need to do this even for bundle-expanded primitives
        // because they are still content-addressed at the time of
        // character creation (per Phase 5 wire-up).
        const primRows = await tx
          .select({
            id: primitives.id,
            userId: primitives.userId,
            sourceOrigin: primitives.sourceOrigin,
          })
          .from(primitives)
          .where(
            inArray(primitives.id, expansion.primitives.map((p) => p.primitiveId)),
          );
        const primMap = new Map(primRows.map((r) => [r.id, r]));
        const slotsWithVersion = await Promise.all(
          expansion.primitives.map(async (p) => {
            const prim = primMap.get(p.primitiveId);
            const versionId = await resolveLatestVersionId(
              "primitive",
              p.primitiveId,
            );
            const slotSource = prim
              ? resolveSlotSource({
                  entity: prim,
                  callerUserId: userId,
                })
              : "PINNED";
            return {
              characterId: created.id,
              primitiveId: p.primitiveId,
              source: p.source,
              acquiredAtLevel: level,
              isMirrored: p.isMirrored,
              versionId,
              slotSource,
              originHeritageId: p.originHeritageId,
              originCapabilityId: p.originCapabilityId,
              originEffectId: p.originEffectId,
            };
          }),
        );
        await tx.insert(characterPrimitives).values(slotsWithVersion);
      }

      // === Phase 8.1 batch 13.1: write expanded capabilities with origin ===
      if (expansion.capabilities.length > 0) {
        const capRows = await tx
          .select({
            id: capabilities.id,
            userId: capabilities.userId,
            sourceOrigin: capabilities.sourceOrigin,
          })
          .from(capabilities)
          .where(inArray(capabilities.id, expandedCapabilityIds));
        const capMap = new Map(capRows.map((r) => [r.id, r]));
        const slotsWithVersion = await Promise.all(
          expansion.capabilities.map(async (c) => {
            const cap = capMap.get(c.capabilityId);
            const versionId = await resolveLatestVersionId(
              "capability",
              c.capabilityId,
            );
            const slotSource = cap
              ? resolveSlotSource({
                  entity: cap,
                  callerUserId: userId,
                })
              : "PINNED";
            return {
              characterId: created.id,
              capabilityId: c.capabilityId,
              acquiredAtLevel: level,
              versionId,
              slotSource,
              // Capabilities slotted through a heritage carry the
              // heritage's id as their origin. Direct slots have
              // origin null.
              originHeritageId: c.originHeritageId,
            };
          }),
        );
        await tx.insert(characterCapabilities).values(slotsWithVersion);
      }

      // === Phase 8.1 batch 13.1: write heritages ===
      if (expansion.heritages.length > 0) {
        const heritageRowsData = await Promise.all(
          expansion.heritages.map(async (h) => {
            // heritage uses "template" as its version entity kind
            // (heritageVersions table is keyed by templateId).
            const versionId = await resolveLatestVersionId(
              "template",
              h.heritageId,
            );
            return {
              characterId: created.id,
              heritageId: h.heritageId,
              acquiredAtLevel: level,
              isMirrored: h.isMirrored,
              versionId,
              slotSource: "PINNED" as const,
            };
          }),
        );
        await tx.insert(characterHeritages).values(heritageRowsData);
      }

      // === Items: separate from primitive expansion (item BU doesn't count) ===
      // ItemsBySource shape: { PERSONAL: [{id, quantity}] }.
      const expandedItemIds: Array<{ id: string; quantity: number }> = [];
      for (const [, list] of Object.entries(rawItemsBySource)) {
        if (!Array.isArray(list)) continue;
        for (const entry of list) {
          if (typeof entry !== "object" || entry === null) continue;
          const e = entry as Record<string, unknown>;
          const id = String(e["id"]);
          if (!id) continue;
          const q = Number(e["quantity"] ?? 1);
          expandedItemIds.push({
            id,
            quantity: Number.isInteger(q) && q > 0 ? q : 1,
          });
        }
      }
      // Also keep legacy itemIds for back-compat
      const allItemIds = Array.from(
        new Set([...itemIds, ...expandedItemIds.map((i) => i.id)]),
      );
      const itemQtyById = new Map(
        expandedItemIds.map((i) => [i.id, i.quantity]),
      );
      if (allItemIds.length > 0) {
        const itemRows = await tx
          .select({
            id: items.id,
            userId: items.userId,
            sourceOrigin: items.sourceOrigin,
          })
          .from(items)
          .where(inArray(items.id, allItemIds));
        const itemMap = new Map(itemRows.map((r) => [r.id, r]));
        const slotsWithVersion = await Promise.all(
          allItemIds.map(async (iid) => {
            const item = itemMap.get(iid);
            const versionId = await resolveLatestVersionId("item", iid);
            const slotSource = item
              ? resolveSlotSource({
                  entity: item,
                  callerUserId: userId,
                })
              : "PINNED";
            return {
              characterId: created.id,
              itemId: iid,
              quantity: itemQtyById.get(iid) ?? 1,
              versionId,
              slotSource,
            };
          }),
        );
        await tx.insert(characterItems).values(slotsWithVersion);
      }

      return tx.query.characters.findFirst({
        where: eq(characters.id, created.id),
        with: {
          primitiveLinks: { with: { primitive: true } },
          capabilityLinks: { with: { capability: true } },
          itemLinks: { with: { item: true } },
        },
      });
    });

    return NextResponse.json({ character: result }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    // Phase 8.2 batch 7 rev 3: surface Drizzle errors with their
    // cause so the user can see what's actually breaking (e.g.
    // FK violation vs unique constraint). Drizzle wraps the
    // underlying pg error in a `cause` property.
    const cause = error instanceof Error && "cause" in error
      ? (error as Error & { cause?: unknown }).cause
      : null;
    console.error(
      "[characters POST] failed:",
      message,
      cause ? `(cause: ${JSON.stringify(cause)})` : "",
    );
    return NextResponse.json(
      {
        error: message,
        // Phase 8.2 batch 7 rev 3: surface the unwrapped pg
        // error in the response so the toast shows it. Without
        // this the user only sees "Failed query: insert into
        // character_primitives ..." which doesn't say *which*
        // FK (or unique constraint) actually violated.
        pgError: cause ? String(cause) : null,
      },
      { status: 400 },
    );
  }
}