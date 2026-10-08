/** Real database services, all changes rolled back including migration and fixtures. */
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { sql, eq, inArray } from "drizzle-orm";
import { db, pool, withDatabaseTransaction } from "@/db/client";
import { createMonster, publishMonster } from "@/lib/monsters/service";
import { monsterBaselines } from "@/lib/monsters/model";
import {
  saveEncounter,
  getEncounter,
  startEncounter,
  getRun,
  mutateRun,
  deleteEncounter,
} from "@/lib/encounters/service";
import { mutateMonsterPlay } from "@/lib/monsters/play-service";
import { monsterCopies, encounterRuns, monsters } from "@/db/schema";
import { systemBestiary } from "@/lib/monsters/catalogue/system-bestiary";
class RollbackCheck extends Error {}
let checks = 0;
const pass = (condition: unknown, label: string) => {
  assert.ok(condition, label);
  checks++;
  console.log(`PASS ${label}`);
};
async function main() {
  try {
    await withDatabaseTransaction(async () => {
      await db.execute(
        sql.raw(
          readFileSync("src/db/migrations/0073_gm_encounters.sql", "utf8"),
        ),
      );
      const owner = `gm-check-${randomUUID()}`;
      const definition = {
        name: "GM rollback fixture",
        budget: 25,
        attributes: { physical: 3, mental: 0, magical: 0 },
        references: [],
      };
      const template = await createMonster(owner, definition);
      const saved = await saveEncounter(owner, {
        name: "Test encounter",
        partyBu: 40,
        partyItemBu: 10,
        entries: [{ templateId: template.id, version: 1, quantity: 2 }],
      });
      pass(
        saved.appraisal.enemyBu === 50 && saved.appraisal.partyTotal === 50,
        "separate party appraisal",
      );
      let rejected = false;
      try {
        await getEncounter("other-owner", saved.id);
      } catch {
        rejected = true;
      }
      pass(rejected, "owner authorization");
      rejected = false;
      try {
        await saveEncounter(owner, saved.definition, saved.id, 99);
      } catch {
        rejected = true;
      }
      pass(rejected, "revision conflict");
      const op = randomUUID();
      const run = await startEncounter(owner, saved.id, op, 0);
      const duplicate = await startEncounter(owner, saved.id, op, 0);
      pass(run.id === duplicate.id, "idempotent start");
      const second = await startEncounter(owner, saved.id, randomUUID(), 0);
      pass(second.id !== run.id, "independent repeated run");
      const first = await getRun(owner, run.id);
      if (!("members" in first)) throw new Error("Missing run roster");
      pass(first.members.length === 2, "one play copy per quantity");
      const copyA = first.members[0]!.copyId!;
      await mutateMonsterPlay(owner, copyA, {
        opId: randomUUID(),
        baseRevision: 0,
        changes: [{ field: "currentVitality", value: 3 }],
      });
      const copies = await db
        .select()
        .from(monsterCopies)
        .where(eq(monsterCopies.userId, owner));
      pass(
        copies.filter((c) => c.currentVitality === 3).length === 1,
        "independent creature state",
      );
      await publishMonster(
        template.id,
        owner,
        {
          ...definition,
          budget: 50,
          attributes: {
            physical: monsterBaselines(50).attributePoints,
            mental: 0,
            magical: 0,
          },
        },
        false,
      );
      const pinned = await getRun(owner, run.id);
      if (!("members" in pinned)) throw new Error("Missing roster");
      pass(
        pinned.members.every((m) => "budget" in m && m.budget === 25),
        "runs retain old template pins",
      );
      const mOp = randomUUID();
      await mutateRun(owner, run.id, {
        opId: mOp,
        baseRevision: 0,
        changes: [{ field: "phase", value: "Fast" }],
      });
      const repeat = await mutateRun(owner, run.id, {
        opId: mOp,
        baseRevision: 0,
        changes: [{ field: "phase", value: "Fast" }],
      });
      pass(repeat.state.revision === 1, "run marker retry receipt");
      rejected = false;
      try {
        await mutateRun(owner, run.id, {
          opId: randomUUID(),
          baseRevision: 0,
          changes: [{ field: "phase", value: "Heavy" }],
        });
      } catch {
        rejected = true;
      }
      pass(rejected, "same-field run conflict");
      const merged = await mutateRun(owner, run.id, {
        opId: randomUUID(),
        baseRevision: 0,
        changes: [{ field: "round", value: 2 }],
      });
      pass(
        merged.state.overrides["phase"] === "Fast" &&
          merged.state.overrides["round"] === 2,
        "different-field run merge",
      );
      rejected = false;
      try {
        await mutateRun(owner, run.id, {
          opId: randomUUID(),
          baseRevision: 2,
          changes: [
            {
              field: `actor:${randomUUID()}`,
              value: { intent: "Rush", track: "Fast", resolved: false },
            },
          ],
        });
      } catch {
        rejected = true;
      }
      pass(rejected, "foreign creature markers rejected");
      const publicOwner = `publisher-${randomUUID()}`;
      const publicTemplate = await createMonster(
        publicOwner,
        { ...definition, name: "Access fixture" },
        true,
      );
      const publicScene = await saveEncounter(owner, {
        name: "Revocation fixture",
        entries: [{ templateId: publicTemplate.id, version: 1, quantity: 1 }],
      });
      const publicRun = await startEncounter(
        owner,
        publicScene.id,
        randomUUID(),
        0,
      );
      await publishMonster(
        publicTemplate.id,
        publicOwner,
        { ...definition, name: "Access fixture" },
        false,
      );
      const inaccessible = await getEncounter(owner, publicScene.id);
      pass(
        inaccessible.creatures[0]?.unavailable &&
          inaccessible.creatures[0]?.name === "Unavailable creature",
        "revoked template hides preparation identity",
      );
      const beforeCopies = await db
        .select()
        .from(monsterCopies)
        .where(eq(monsterCopies.userId, owner));
      rejected = false;
      try {
        await startEncounter(owner, publicScene.id, randomUUID(), 0);
      } catch {
        rejected = true;
      }
      const afterCopies = await db
        .select()
        .from(monsterCopies)
        .where(eq(monsterCopies.userId, owner));
      pass(
        rejected && beforeCopies.length === afterCopies.length,
        "failed start creates no partial copies",
      );
      const retained = await getRun(owner, publicRun.id);
      pass(
        "members" in retained && !retained.members[0]?.unavailable,
        "existing pinned copies survive template revocation",
      );
      await deleteEncounter(owner, saved.id);
      const preserved = await getRun(owner, run.id);
      pass(
        "run" in preserved && preserved.run.encounterId === null,
        "preparation deletion preserves run",
      );
      await db.delete(monsterCopies).where(eq(monsterCopies.id, copyA));
      const removed = await getRun(owner, run.id);
      pass(
        "members" in removed && removed.members.some((m) => m.copyId === null),
        "copy deletion leaves readable run",
      );
      await db.delete(encounterRuns).where(eq(encounterRuns.id, run.id));
      const leftover = await db.execute(
        sql`SELECT count(*)::int n FROM play_states WHERE subject_id=${run.id}`,
      );
      pass(leftover.rows[0]?.n === 0, "run deletion clears marker state");
      const initial = await db
        .select()
        .from(monsters)
        .where(
          inArray(
            monsters.name,
            systemBestiary.slice(0, 12).map((m) => m.name),
          ),
        );
      if (initial.length === 12) {
        const initialScene = await saveEncounter(owner, {
          name: "First twelve workflow audit",
          partyBu: 500,
          partyItemBu: 100,
          entries: initial.map((m) => ({
            templateId: m.id,
            version: m.version,
            quantity: 1,
          })),
        });
        const initialRun = await startEncounter(
          owner,
          initialScene.id,
          randomUUID(),
          0,
        );
        const roster = await getRun(owner, initialRun.id);
        pass(
          "members" in roster &&
            roster.members.length === 12 &&
            roster.members.every((m) => "maximum" in m && m.maximum > 0),
          "initial twelve complete preparation and playable run pipeline",
        );
      }
      throw new RollbackCheck();
    });
  } catch (e) {
    if (!(e instanceof RollbackCheck)) throw e;
  }
  console.log(
    `${checks} real-database checks passed; all fixture and schema writes rolled back.`,
  );
}
main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
