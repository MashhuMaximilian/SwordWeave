import { inArray } from "drizzle-orm";
import type { AnyPgTable, AnyPgColumn } from "drizzle-orm/pg-core";
import { db } from "@/db/client";
import * as s from "@/db/schema";
import type { EntityKind, EntityKey } from "./model";
type Link = {
  kind: EntityKind;
  id: string | number;
  data: Record<string, unknown>;
};
type Relation = {
  table: AnyPgTable;
  parent: AnyPgColumn;
  parentField: string;
  kind: EntityKind;
  childField: string;
};
const configuration = {
  primitive: {
    table: s.primitives,
    id: s.primitives.id,
    versions: s.primitiveVersions,
    versionEntity: s.primitiveVersions.primitiveId,
    versionField: "primitiveId",
    relations: [],
  },
  effect: {
    table: s.effects,
    id: s.effects.id,
    versions: s.effectVersions,
    versionEntity: s.effectVersions.effectId,
    versionField: "effectId",
    relations: [
      {
        table: s.effectPrimitives,
        parent: s.effectPrimitives.effectId,
        parentField: "effectId",
        kind: "primitive",
        childField: "primitiveId",
      },
    ],
  },
  capability: {
    table: s.capabilities,
    id: s.capabilities.id,
    versions: s.capabilityVersions,
    versionEntity: s.capabilityVersions.capabilityId,
    versionField: "capabilityId",
    relations: [
      {
        table: s.capabilityPrimitives,
        parent: s.capabilityPrimitives.capabilityId,
        parentField: "capabilityId",
        kind: "primitive",
        childField: "primitiveId",
      },
      {
        table: s.capabilityEffects,
        parent: s.capabilityEffects.capabilityId,
        parentField: "capabilityId",
        kind: "effect",
        childField: "effectId",
      },
    ],
  },
  heritage: {
    table: s.heritage,
    id: s.heritage.id,
    versions: s.heritageVersions,
    versionEntity: s.heritageVersions.templateId,
    versionField: "templateId",
    relations: [
      {
        table: s.heritagePrimitives,
        parent: s.heritagePrimitives.templateId,
        parentField: "templateId",
        kind: "primitive",
        childField: "primitiveId",
      },
      {
        table: s.heritageCapabilities,
        parent: s.heritageCapabilities.templateId,
        parentField: "templateId",
        kind: "capability",
        childField: "capabilityId",
      },
    ],
  },
  item: {
    table: s.items,
    id: s.items.id,
    versions: s.itemVersions,
    versionEntity: s.itemVersions.itemId,
    versionField: "itemId",
    relations: [
      {
        table: s.itemPrimitives,
        parent: s.itemPrimitives.itemId,
        parentField: "itemId",
        kind: "primitive",
        childField: "primitiveId",
      },
      {
        table: s.itemCapabilities,
        parent: s.itemCapabilities.itemId,
        parentField: "itemId",
        kind: "capability",
        childField: "capabilityId",
      },
      {
        table: s.itemEffects,
        parent: s.itemEffects.itemId,
        parentField: "itemId",
        kind: "effect",
        childField: "effectId",
      },
    ],
  },
} satisfies Record<
  EntityKind,
  {
    table: AnyPgTable;
    id: AnyPgColumn;
    versions: AnyPgTable;
    versionEntity: AnyPgColumn;
    versionField: string;
    relations: Relation[];
  }
>;
export type LoadedNode = {
  row: Record<string, unknown>;
  links: Link[];
  versions: { id: string; number: number; latest: boolean }[];
};
/** One batch per entity type and depth, independent of character inventory size. */
export async function loadWorkspaceNodes(
  keys: readonly EntityKey[],
): Promise<Map<EntityKey, LoadedNode>> {
  const output = new Map<EntityKey, LoadedNode>();
  await Promise.all(
    (Object.keys(configuration) as EntityKind[]).map(async (kind) => {
      const ids = keys
        .filter((k) => k.startsWith(`${kind}:`))
        .map((k) =>
          kind === "primitive" ? Number(k.slice(10)) : k.slice(kind.length + 1),
        );
      if (!ids.length) return;
      const config = configuration[kind];
      const [rows, versions, ...relations] = await Promise.all([
        db.select().from(config.table).where(inArray(config.id, ids)),
        db
          .select()
          .from(config.versions)
          .where(inArray(config.versionEntity, ids)),
        ...config.relations.map((r) =>
          db
            .select()
            .from(r.table)
            .where(inArray(r.parent, ids.map(String))),
        ),
      ]);
      for (const row of rows as Record<string, unknown>[]) {
        const id = String(row["id"]);
        const links = config.relations.flatMap((relation, index) =>
          (relations[index] as Record<string, unknown>[])
            .filter((r) => String(r[relation.parentField]) === id)
            .map((data) => ({
              kind: relation.kind as EntityKind,
              id: data[relation.childField] as string | number,
              data,
            })),
        );
        output.set(`${kind}:${id}`, {
          row,
          links,
          versions: (versions as Record<string, unknown>[])
            .filter((v) => String(v[config.versionField]) === id)
            .map((v) => ({
              id: String(v["id"]),
              number: Number(v["versionNumber"]),
              latest: Boolean(v["isLatest"]),
            })),
        });
      }
    }),
  );
  return output;
}
