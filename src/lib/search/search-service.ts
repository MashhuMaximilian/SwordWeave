// =============================================================================
// Search service — Phase 6.5 #16
//
// Powers /search?q=... page. Uses ILIKE across name + body-text columns
// across all library content types. Returns a flat list of hits sorted
// by a weighted relevance score (name match > body match).
//
// NOTE: This is the ILIKE implementation. Future enhancement: Postgres
// pg_trgm for fuzzy + tsvector for full-text. The score field and sort
// layer here are designed to swap to FTS ranking without API changes.
// =============================================================================

import { and, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  capabilities,
  characters,
  effects,
  items,
  primitives,
  heritage,
} from "@/db/schema";

export type SearchTargetType =
  | "PRIMITIVE"
  | "CAPABILITY"
  | "EFFECT"
  | "CHARACTER"
  | "ITEM"
  | "LINEAGE_TEMPLATE"
  | "UPBRINGING_TEMPLATE"
  | "MANIFEST_TEMPLATE";

export interface SearchHit {
  id: string;
  targetType: SearchTargetType;
  name: string;
  description: string | null;
  imageUrl: string | null;
  authorUsername: string | null;
  /** 0..1, name-match-heavy weighted score */
  score: number;
}

export interface SearchResult {
  hits: SearchHit[];
  total: number;
  query: string;
}

interface SearchOptions {
  query: string;
  targetType?: SearchTargetType;
  limit?: number;
  offset?: number;
}

const DEFAULT_LIMIT = 30;

/**
 * Build a weighted relevance score expression for a (nameColumn, bodyColumn) pair.
 * Returns 1.0 for startsWith on name, 0.8 for contains, 0.5 for body match, 0.3 fallback.
 */
function relevanceScore(nameCol: any, bodyCol: any) {
  const lowerName = sql<string>`LOWER(${nameCol})`;
  const lowerBody = bodyCol ? sql<string>`LOWER(${bodyCol})` : sql<string>`NULL`;
  const qLower = sql<string>`LOWER(${sql.raw("?")})`; // placeholder, replaced below
  // We'll inline the query in each call site for simplicity.
  return null as unknown as ReturnType<typeof sql>; // suppress unused
}

export async function searchLibrary({
  query,
  targetType,
  limit = DEFAULT_LIMIT,
  offset = 0,
}: SearchOptions): Promise<SearchResult> {
  const trimmed = query.trim();
  if (trimmed.length === 0) {
    return { hits: [], total: 0, query: "" };
  }

  // ILIKE pattern; escape % and _ so user input doesn't act as wildcards.
  const escaped = trimmed.replace(/[\\%_]/g, (c) => `\\${c}`);
  const pattern = `%${escaped}%`;
  const startsPattern = `${escaped}%`;

  // Build a per-call relevance expression that captures the user's query.
  function scoreExpr(nameCol: any, bodyCol: any) {
    return sql<number>`CASE
      WHEN LOWER(${nameCol}) LIKE LOWER(${trimmed}) || '%' THEN 1.0
      WHEN LOWER(${nameCol}) LIKE '%' || LOWER(${trimmed}) || '%' THEN 0.8
      WHEN ${bodyCol} IS NOT NULL AND LOWER(${bodyCol}) LIKE '%' || LOWER(${trimmed}) || '%' THEN 0.5
      ELSE 0.3
    END`.as("score");
  }

  // Decide which tables to query based on optional type filter.
  const wants = (t: SearchTargetType): boolean =>
    !targetType || targetType === t;

  // For multi-type search we run one query per table and merge.
  const perTypeLimit = targetType ? limit : Math.ceil(limit / 7) + 5;

  const hits: SearchHit[] = [];

  if (wants("PRIMITIVE")) {
    const nameOrBody = or(
      ilike(primitives.name, pattern),
      ilike(primitives.name, startsPattern),
      ilike(primitives.mechanicalOutputText, pattern),
      ilike(primitives.narrativeRule, pattern),
    );
    const rows = await db
      .select({
        id: primitives.id,
        name: primitives.name,
        body: primitives.mechanicalOutputText,
        imageUrl: sql<string | null>`NULL`,
        authorUsername: sql<string | null>`NULL`,
        score: scoreExpr(primitives.name, primitives.mechanicalOutputText),
      })
      .from(primitives)
      .where(
        and(
          or(eq(primitives.isPublic, true), sql`${primitives.userId} IS NULL`),
          nameOrBody,
        ),
      )
      .orderBy(sql`score DESC`, sql`${primitives.name} ASC`)
      .limit(perTypeLimit)
      .offset(offset);
    for (const r of rows) {
      hits.push({
        id: String(r.id),
        targetType: "PRIMITIVE",
        name: r.name,
        description: r.body ?? null,
        imageUrl: r.imageUrl,
        authorUsername: r.authorUsername,
        score: Number(r.score ?? 0),
      });
    }
  }

  if (wants("CAPABILITY")) {
    const nameOrBody = or(
      ilike(capabilities.name, pattern),
      ilike(capabilities.verboseDescription, pattern),
    );
    const rows = await db
      .select({
        id: capabilities.id,
        name: capabilities.name,
        body: capabilities.verboseDescription,
        authorUsername: sql<string | null>`NULL`,
        score: scoreExpr(capabilities.name, capabilities.verboseDescription),
      })
      .from(capabilities)
      .where(
        and(
          eq(capabilities.isPublic, true),
          nameOrBody,
        ),
      )
      .orderBy(sql`score DESC`, sql`${capabilities.name} ASC`)
      .limit(perTypeLimit)
      .offset(offset);
    for (const r of rows) {
      hits.push({
        id: String(r.id),
        targetType: "CAPABILITY",
        name: r.name,
        description: r.body,
        imageUrl: null,
        authorUsername: r.authorUsername,
        score: Number(r.score ?? 0),
      });
    }
  }

  if (wants("EFFECT")) {
    const nameOrBody = or(
      ilike(effects.name, pattern),
      ilike(effects.narrativeDescription, pattern),
    );
    const rows = await db
      .select({
        id: effects.id,
        name: effects.name,
        body: effects.narrativeDescription,
        authorUsername: sql<string | null>`NULL`,
        score: scoreExpr(effects.name, effects.narrativeDescription),
      })
      .from(effects)
      .where(nameOrBody)
      .orderBy(sql`score DESC`, sql`${effects.name} ASC`)
      .limit(perTypeLimit)
      .offset(offset);
    for (const r of rows) {
      hits.push({
        id: String(r.id),
        targetType: "EFFECT",
        name: r.name,
        description: r.body,
        imageUrl: null,
        authorUsername: r.authorUsername,
        score: Number(r.score ?? 0),
      });
    }
  }

  if (wants("ITEM")) {
    const nameOrBody = or(
      ilike(items.name, pattern),
      ilike(items.description, pattern),
    );
    const rows = await db
      .select({
        id: items.id,
        name: items.name,
        body: items.description,
        authorUsername: sql<string | null>`NULL`,
        score: scoreExpr(items.name, items.description),
      })
      .from(items)
      .where(and(eq(items.isPublic, true), nameOrBody))
      .orderBy(sql`score DESC`, sql`${items.name} ASC`)
      .limit(perTypeLimit)
      .offset(offset);
    for (const r of rows) {
      hits.push({
        id: String(r.id),
        targetType: "ITEM",
        name: r.name,
        description: r.body,
        imageUrl: null,
        authorUsername: r.authorUsername,
        score: Number(r.score ?? 0),
      });
    }
  }

  if (
    wants("LINEAGE_TEMPLATE") ||
    wants("UPBRINGING_TEMPLATE") ||
    wants("MANIFEST_TEMPLATE")
  ) {
    const wantedKinds: string[] = [];
    if (wants("LINEAGE_TEMPLATE")) wantedKinds.push("LINEAGE");
    if (wants("UPBRINGING_TEMPLATE")) wantedKinds.push("UPBRINGING");
    if (wants("MANIFEST_TEMPLATE")) wantedKinds.push("MANIFEST");
    const nameOrBody = or(
      ilike(heritage.name, pattern),
      ilike(heritage.description, pattern),
    );
    const rows = await db
      .select({
        id: heritage.id,
        kind: heritage.kind,
        name: heritage.name,
        body: heritage.description,
        authorUsername: sql<string | null>`NULL`,
        score: scoreExpr(heritage.name, heritage.description),
      })
      .from(heritage)
      .where(
        and(
          eq(heritage.isPublic, true),
          inArray(heritage.kind, wantedKinds as never),
          nameOrBody,
        ),
      )
      .orderBy(sql`score DESC`, sql`${heritage.name} ASC`)
      .limit(perTypeLimit)
      .offset(offset);
    for (const r of rows) {
      hits.push({
        id: String(r.id),
        targetType: `${r.kind}_TEMPLATE` as SearchTargetType,
        name: r.name,
        description: r.body,
        imageUrl: null,
        authorUsername: r.authorUsername,
        score: Number(r.score ?? 0),
      });
    }
  }

  if (wants("CHARACTER")) {
    const nameOrBody = or(
      ilike(characters.name, pattern),
      ilike(characters.notes, pattern),
    );
    const rows = await db
      .select({
        id: characters.id,
        name: characters.name,
        body: characters.notes,
        authorUsername: sql<string | null>`NULL`,
        score: scoreExpr(characters.name, characters.notes),
      })
      .from(characters)
      .where(
        and(
          eq(characters.isPublic, true),
          nameOrBody,
        ),
      )
      .orderBy(sql`score DESC`, sql`${characters.name} ASC`)
      .limit(perTypeLimit)
      .offset(offset);
    for (const r of rows) {
      hits.push({
        id: String(r.id),
        targetType: "CHARACTER",
        name: r.name,
        description: r.body,
        imageUrl: null,
        authorUsername: r.authorUsername,
        score: Number(r.score ?? 0),
      });
    }
  }

  // Sort all hits by score desc, then name asc
  hits.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.name.localeCompare(b.name);
  });

  return {
    hits: hits.slice(0, limit),
    total: hits.length,
    query: trimmed,
  };
}

/**
 * Find which positions in `text` match `query` (case-insensitive).
 * Used to wrap matches in <mark> for highlight rendering.
 */
export function findMatchRanges(
  text: string,
  query: string,
): Array<{ start: number; end: number }> {
  const ranges: Array<{ start: number; end: number }> = [];
  if (!query) return ranges;
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  let idx = lower.indexOf(q);
  while (idx !== -1) {
    ranges.push({ start: idx, end: idx + q.length });
    idx = lower.indexOf(q, idx + q.length);
  }
  return ranges;
}