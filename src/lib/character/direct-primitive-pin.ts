import { sql } from "drizzle-orm";
import { primitives, primitiveVersions } from "@/db/schema";

/** Only a single, independently reproducible current definition can be
 * advertised or placed by the starter adapter. Its cost and mechanics must
 * agree with the snapshot the character sheet will actually use. */
export const directPrimitivePinCondition = sql`
  ${primitiveVersions.isLatest}
  AND ${primitiveVersions.deltaKind} = 'FULL'
  AND (SELECT count(*) FROM primitive_versions other
    WHERE other.primitive_id = ${primitives.id} AND other.is_latest) = 1
  AND ${primitives.templatePrimitiveId} IS NULL
  AND ${primitiveVersions.snapshot}->>'templatePrimitiveId' IS NULL
  AND ${primitiveVersions.snapshot}->>'name' = ${primitives.name}
  AND ${primitiveVersions.snapshot}->>'category' = ${primitives.category}::text
  AND ${primitiveVersions.snapshot}->'buCost' = to_jsonb(${primitives.buCost})
  AND ${primitiveVersions.snapshot}->'hardModifiers' = ${primitives.hardModifiers}
  AND ${primitiveVersions.snapshot}->>'mechanicalOutputText' = ${primitives.mechanicalOutputText}
  AND COALESCE(${primitiveVersions.snapshot}->'mechanicalRule', '{}'::jsonb) = ${primitives.mechanicalRule}
  AND COALESCE(${primitiveVersions.snapshot}->'isMirrorable', 'false'::jsonb) = to_jsonb(${primitives.isMirrorable})
  AND COALESCE(${primitiveVersions.snapshot}->'mirrorBuCredit', '0'::jsonb) = to_jsonb(${primitives.mirrorBuCredit})
  AND COALESCE(${primitiveVersions.snapshot}->>'mirrorVector', 'STANDARD_ONLY') = ${primitives.mirrorVector}
  AND COALESCE(${primitiveVersions.snapshot}->'dependencyPins', '[]'::jsonb) = '[]'::jsonb
  AND COALESCE(${primitiveVersions.snapshot}->'capabilityIds', '[]'::jsonb) = '[]'::jsonb
  AND COALESCE(${primitiveVersions.snapshot}->'effectIds', '[]'::jsonb) = '[]'::jsonb
  AND COALESCE(${primitiveVersions.snapshot}#>'{consequenceBehavior,restrictions}', '[]'::jsonb) = '[]'::jsonb
  AND COALESCE(${primitiveVersions.snapshot}->'consequenceBehavior', 'null'::jsonb) = COALESCE(${primitives.consequenceBehavior}, 'null'::jsonb)
`;
